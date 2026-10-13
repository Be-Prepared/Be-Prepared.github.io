import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { PermissionStatus } from './permission-status';

export const enum AccessState {
    // Looking at the permission, or waiting for the browser to answer a
    // request. Nothing to show yet.
    CHECKING = 'CHECKING',

    // Permission hasn't been asked for. Explain why it's needed and let the
    // person decide.
    PROMPT = 'PROMPT',

    // Permission was refused. The person can try again or fix it in the
    // browser's settings.
    DENIED = 'DENIED',

    // The hardware isn't there.
    UNAVAILABLE = 'UNAVAILABLE',

    // Something else went wrong, such as the camera being used by another
    // app. Usually temporary.
    ERROR = 'ERROR',

    // The resource is acquired and in use.
    READY = 'READY',
}

export interface AccessControllerConfig<T> {
    // Current permission state plus changes.
    permission: Observable<PermissionStatus>;

    // Acquire the resource. This is where the browser shows its prompt.
    acquire: () => Promise<T>;

    // Give the resource back, such as stopping camera tracks.
    release: (resource: T) => void;

    // Map a failure from acquire() into a state.
    classifyError?: (error: any) => AccessState;

    // Release the resource while the app is in the background and acquire it
    // again when it comes back. Defaults to true.
    releaseWhenHidden?: boolean;

    // How long request() shows CHECKING before giving the button back.
    // Browsers don't say when a prompt is ignored or dismissed, and the
    // acquire may then never finish. For tests.
    unansweredMs?: number;

    // For tests.
    document?: Pick<
        Document,
        'addEventListener' | 'removeEventListener' | 'visibilityState'
    >;
    window?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
}

const UNANSWERED_MS = 8000;

export function classifyMediaError(error: any): AccessState {
    switch (error && error.name) {
        case 'NotAllowedError':
        case 'PermissionDeniedError':
        case 'SecurityError':
            return AccessState.DENIED;

        case 'NotFoundError':
        case 'DevicesNotFoundError':
        case 'OverconstrainedError':
        case 'NotSupportedError':
            return AccessState.UNAVAILABLE;

        default:
            // NotReadableError, AbortError, etc. The device exists but could
            // not be started, often because something else is using it.
            return AccessState.ERROR;
    }
}

// Manages the life of a permission-gated resource for one screen.
//
// * Nothing is cached. Every time a screen opens, the permission is looked at
//   fresh, so permissions re-enabled in settings are picked up.
// * Nothing is acquired unless permission is already granted or the person
//   explicitly asks with request().
// * The resource is always released on destroy() and when the page is
//   hidden, so the camera never stays locked by a backgrounded app.
export class AccessController<T> {
    // Emits the resource when acquired and null when released. A new
    // resource is acquired after the app returns from the background, so
    // anything attached to the old one (such as a video element's
    // srcObject) needs to be updated.
    readonly resourceChanges: Observable<T | null>;
    readonly state: Observable<AccessState>;
    private _acquiringGeneration: number | null = null;
    private _config: AccessControllerConfig<T>;
    private _document: AccessControllerConfig<T>['document'];
    private _window: AccessControllerConfig<T>['window'];
    private _generation = 0;
    private _permission = PermissionStatus.UNKNOWN;
    private _resource = new BehaviorSubject<T | null>(null);
    private _resumeWhenVisible = false;
    private _state = new BehaviorSubject<AccessState>(AccessState.CHECKING);
    private _subscription: Subscription | null = null;
    private _unanswered: ReturnType<typeof setTimeout> | null = null;
    private _visibilityListener = () => this._visibilityChange();
    private _pageHideListener = () => this._pageHide();
    private _pageShowListener = () => this._resume();

    constructor(config: AccessControllerConfig<T>) {
        this._config = config;
        this._document =
            config.document ||
            (typeof document === 'undefined' ? undefined : document);
        // pagehide and pageshow only fire on window.
        this._window =
            config.window ||
            (typeof window === 'undefined' ? undefined : window);
        this.state = this._state.asObservable();
        this.resourceChanges = this._resource.asObservable();
    }

    get currentState() {
        return this._state.value;
    }

    get resource() {
        return this._resource.value;
    }

    destroy() {
        this._generation += 1;
        this._subscription?.unsubscribe();
        this._subscription = null;
        this._document?.removeEventListener(
            'visibilitychange',
            this._visibilityListener
        );
        this._window?.removeEventListener('pagehide', this._pageHideListener);
        this._window?.removeEventListener('pageshow', this._pageShowListener);
        this._releaseResource();

        if (this._unanswered) {
            clearTimeout(this._unanswered);
            this._unanswered = null;
        }

        this._state.complete();
        this._resource.complete();
    }

    init() {
        this._document?.addEventListener(
            'visibilitychange',
            this._visibilityListener
        );
        this._window?.addEventListener('pagehide', this._pageHideListener);
        this._window?.addEventListener('pageshow', this._pageShowListener);
        this._subscription = this._config.permission.subscribe((status) => {
            this._permission = status;
            this._permissionChanged(status);
        });
    }

    // Called from a button press. Tries to acquire the resource, which shows
    // the browser's permission prompt when needed.
    request() {
        const before = this.currentState;

        switch (before) {
            case AccessState.PROMPT:
            case AccessState.DENIED:
            case AccessState.ERROR:
                // Shows that the press did something. A browser that is
                // blocking the resource refuses without a prompt, and the
                // state would otherwise never change.
                this._setState(AccessState.CHECKING);
                // Bring the button back if no answer comes. A late answer
                // still counts.
                this._unanswered = setTimeout(() => {
                    this._unanswered = null;

                    if (this.currentState === AccessState.CHECKING) {
                        this._setState(before);
                    }
                }, this._config.unansweredMs ?? UNANSWERED_MS);
        }

        return this._acquire();
    }

    // Stop using the resource without destroying the controller.
    release() {
        this._generation += 1;
        this._releaseResource();
    }

    private _acquire(): Promise<void> {
        // An acquisition that started before the last release() is stale and
        // its result will be thrown away, so a new one is needed.
        if (this.resource || this._acquiringGeneration === this._generation) {
            return Promise.resolve();
        }

        const generation = ++this._generation;
        this._acquiringGeneration = generation;
        const done = () => {
            if (this._acquiringGeneration === generation) {
                this._acquiringGeneration = null;
            }
        };

        // A synchronous throw (for example a missing browser API) counts as
        // a failed acquire, not a crash that leaves the screen spinning.
        let acquiring: Promise<T>;

        try {
            acquiring = Promise.resolve(this._config.acquire());
        } catch (error) {
            acquiring = Promise.reject(error);
        }

        return acquiring.then(
            (resource) => {
                done();

                if (generation !== this._generation) {
                    // Destroyed or released while waiting.
                    this._config.release(resource);

                    return;
                }

                if (
                    this._isHidden() &&
                    this._config.releaseWhenHidden !== false
                ) {
                    // The app went to the background while waiting. Don't
                    // hold the camera there; pick it up again when visible.
                    this._config.release(resource);
                    this._resumeWhenVisible = true;

                    return;
                }

                this._setState(AccessState.READY);
                this._resource.next(resource);
            },
            (error) => {
                done();

                if (generation !== this._generation) {
                    return;
                }

                const classify =
                    this._config.classifyError || classifyMediaError;
                this._setState(classify(error));
            }
        );
    }

    private _isHidden() {
        return this._document?.visibilityState === 'hidden';
    }

    private _pageHide() {
        // An acquisition still waiting for an answer is thrown away by
        // release(), so it has to be started again too.
        if (this.resource || this._acquiringGeneration !== null) {
            this._resumeWhenVisible = true;
        }

        this.release();
    }

    private _permissionChanged(status: PermissionStatus) {
        switch (status) {
            case PermissionStatus.GRANTED:
                if (this._isHidden()) {
                    this._resumeWhenVisible = true;
                } else {
                    this._acquire();
                }
                break;

            case PermissionStatus.UNKNOWN:
                // The only way to know is to try. The browser will prompt if
                // it needs to.
                if (this._isHidden()) {
                    this._resumeWhenVisible = true;
                } else {
                    this._acquire();
                }
                break;

            case PermissionStatus.PROMPT:
                if (!this.resource) {
                    this._setState(AccessState.PROMPT);
                }
                break;

            case PermissionStatus.DENIED:
                this.release();
                this._setState(AccessState.DENIED);
                break;
        }
    }

    private _releaseResource() {
        const resource = this.resource;

        if (resource) {
            if (!this._resource.closed) {
                this._resource.next(null);
            }

            this._config.release(resource);
        }
    }

    private _setState(state: AccessState) {
        if (this._unanswered) {
            clearTimeout(this._unanswered);
            this._unanswered = null;
        }

        if (!this._state.closed && this._state.value !== state) {
            this._state.next(state);
        }
    }

    private _visibilityChange() {
        if (this._config.releaseWhenHidden === false) {
            return;
        }

        if (this._isHidden()) {
            if (this.resource || this._acquiringGeneration !== null) {
                this._resumeWhenVisible = true;
            }

            if (this.resource) {
                this.release();
            }
        } else {
            this._resume();
        }
    }

    private _resume() {
        if (this._isHidden() || !this._resumeWhenVisible) {
            return;
        }

        this._resumeWhenVisible = false;

        if (this._permission !== PermissionStatus.DENIED) {
            this._acquire();
        }
    }
}
