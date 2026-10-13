import { AccessState } from '../services/access/access-controller';
import { BrowserPlatform } from '../services/browser/browser-detect';
import { BrowserService } from '../services/browser.service';
import { component, css, emit, html } from 'fudgel';
import { di } from '../di';
import { goBack } from '../util/go-back';

interface ScreenConfig {
    action: string | null;
    // Shown when the button was pressed on this screen and nothing changed.
    again: string | null;
    heading: string;
    // Where to go to fix it. Ids ending in ".html" hold a list of steps.
    hint: string | null;
    hintHtml: string | null;
    icon: string;
    message: string | null;
}

// The button looks busy for at least this long after a press. A browser
// that is blocking something refuses instantly, and the press has to be
// seen to have done something.
const MIN_BUSY_MS = 600;

// Explains what's going on when a tool can't run yet: permission needs to be
// asked for, was denied, the hardware is missing, or something failed. Emits
// "grant" when the person wants to (re)try.
//
// While the state is CHECKING after a press, the screen stays up with a busy
// button instead of going blank, so there is always a way back.
export class AccessScreenComponent {
    private _browserService = di(BrowserService);
    private _busyUntil = 0;
    // The button was pressed on the blocked or failed screen.
    private _retrying = false;
    private _timer: ReturnType<typeof setTimeout> | null = null;
    // Explanation of why the permission is needed.
    messageId = '';
    // Message when the hardware is missing.
    unavailableId = '';
    // Message when starting failed for another reason.
    errorId = '';
    // Icon shown on the prompt screen.
    icon = '/lock.svg';
    // What is being asked for, when it has its own instructions for
    // unblocking it: "location".
    kind = '';
    state: AccessState = AccessState.CHECKING;
    // A press of the button is waiting for the browser's answer.
    busy = false;
    // The card on screen. It stays up, with a busy button, while waiting.
    config: ScreenConfig | null = null;
    // The button was pressed on this card and nothing changed.
    tried = false;

    onChange() {
        this._update();
    }

    onDestroy() {
        this._clearTimer();
    }

    back() {
        goBack();
    }

    grant() {
        if (this.busy) {
            return;
        }

        this._retrying =
            this.state === AccessState.DENIED ||
            this.state === AccessState.ERROR;
        this._busyUntil = Date.now() + MIN_BUSY_MS;
        this._update();
        emit(this, 'grant');
    }

    private _clearTimer() {
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
    }

    private _config(): ScreenConfig | null {
        switch (this.state) {
            case AccessState.PROMPT:
                return {
                    action: 'shared.access.allow',
                    again: null,
                    heading: 'shared.access.prompt.heading',
                    hint: 'shared.access.prompt.hint',
                    hintHtml: null,
                    icon: this.icon || '/lock.svg',
                    message: this.messageId || null,
                };

            case AccessState.DENIED: {
                const hint = this._deniedHint();
                const isHtml = hint.endsWith('.html');

                return {
                    action: 'shared.access.tryAgain',
                    again: 'shared.access.denied.again',
                    heading: 'shared.access.denied.heading',
                    hint: isHtml ? null : hint,
                    hintHtml: isHtml ? hint : null,
                    icon: '/lock.svg',
                    message: 'shared.access.denied.message',
                };
            }

            case AccessState.UNAVAILABLE:
                return {
                    action: null,
                    again: null,
                    heading: 'shared.access.unavailable.heading',
                    hint: null,
                    hintHtml: null,
                    icon: '/warning.svg',
                    message:
                        this.unavailableId ||
                        'shared.access.unavailable.message',
                };

            case AccessState.ERROR:
                return {
                    action: 'shared.access.tryAgain',
                    again: 'shared.access.error.again',
                    heading: 'shared.access.error.heading',
                    hint: null,
                    hintHtml: null,
                    icon: '/warning.svg',
                    message: this.errorId || 'shared.access.error.message',
                };

            default:
                return null;
        }
    }

    // Where to go to unblock it. Nothing on a web page can open those
    // settings, so the steps are spelled out.
    private _deniedHint() {
        switch (this._browserService.detect().platform) {
            case BrowserPlatform.IOS:
                return this.kind === 'location'
                    ? 'shared.access.deniedHint.ios.location.html'
                    : 'shared.access.deniedHint.ios';

            case BrowserPlatform.ANDROID:
                return 'shared.access.deniedHint.android';

            default:
                return 'shared.access.deniedHint.other';
        }
    }

    private _update() {
        const config = this._config();
        const wait = this._busyUntil - Date.now();
        this._clearTimer();

        if (!config || wait > 0) {
            // Waiting for an answer, or the answer came back too fast to
            // have been seen. Before anything has been shown there is only
            // the spinner.
            this.busy = !!this.config;

            if (config) {
                this._timer = setTimeout(() => this._update(), wait);
            }

            return;
        }

        this.tried = this._retrying;
        this._retrying = false;
        this._busyUntil = 0;
        this.busy = false;
        this.config = config;
    }
}

component(
    'access-screen',
    {
        attr: ['messageId', 'unavailableId', 'errorId', 'icon', 'kind', 'state'],
        style: css`
            :host {
                display: flex;
                position: absolute;
                inset: 0;
                padding: var(--space-4);
                box-sizing: border-box;
                overflow: auto;
            }

            .card {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: var(--space-3);
                max-width: 26rem;
                width: 100%;
                text-align: center;
                /* Centers when it fits, scrolls from the top when it doesn't
                   (short landscape screens). */
                margin: auto;
            }

            .checking {
                margin: auto;
            }

            @media (max-height: 480px) {
                .card {
                    gap: var(--space-2);
                }

                .icon {
                    width: 2.75rem;
                    height: 2.75rem;
                }

                .heading {
                    font-size: 1.25rem;
                }

                .actions {
                    flex-direction: row;
                }

                .actions pretty-button {
                    flex: 1;
                }
            }

            .icon {
                width: 4.5rem;
                height: 4.5rem;
                color: var(--accent);
            }

            .heading {
                font-size: 1.5rem;
                font-weight: 700;
                margin: 0;
            }

            .message {
                margin: 0;
                font-size: 1.05rem;
            }

            /* Steps someone has to follow in another app, so not small. */
            .hint {
                margin: 0;
                font-size: 1rem;
                line-height: 1.4;
                color: var(--fg-muted);
                background: var(--surface);
                border: 1px solid var(--border);
                border-radius: var(--radius-m);
                padding: var(--space-3);
                text-align: start;
            }

            .again {
                margin: 0;
                width: 100%;
                box-sizing: border-box;
                padding: var(--space-2) var(--space-3);
                font-weight: 600;
                color: var(--fg);
                background: var(--warning-bg);
                border: 1px solid var(--warning);
                border-radius: var(--radius-m);
            }

            .busy {
                display: inline-block;
                width: 1em;
                height: 1em;
                margin-inline-end: var(--space-2);
                vertical-align: -0.15em;
                box-sizing: border-box;
                border-radius: 50%;
                border: 2px solid currentColor;
                border-top-color: transparent;
                animation: spin 1s linear infinite;
            }

            .actions {
                display: flex;
                flex-direction: column;
                gap: var(--space-2);
                width: 100%;
                margin-top: var(--space-2);
            }

            .checking {
                width: 2.5rem;
                height: 2.5rem;
                border-radius: 50%;
                border: 3px solid var(--border);
                border-top-color: var(--accent);
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                to {
                    transform: rotate(360deg);
                }
            }
        `,
        template: html`
            <div *if="!config" class="checking"></div>
            <div
                *if="config"
                class="card"
                aria-busy="{{busy ? 'true' : 'false'}}"
            >
                <load-svg class="icon" href="{{config.icon}}"></load-svg>
                <h1 class="heading">
                    <i18n-label id="{{config.heading}}" ws=""></i18n-label>
                </h1>
                <p *if="tried && config.again" class="again" role="status">
                    <i18n-label id="{{config.again}}" ws=""></i18n-label>
                </p>
                <p *if="config.message" class="message">
                    <i18n-label id="{{config.message}}" ws=""></i18n-label>
                </p>
                <p *if="config.hint" class="hint">
                    <i18n-label id="{{config.hint}}" ws=""></i18n-label>
                </p>
                <div *if="config.hintHtml" class="hint">
                    <i18n-html id="{{config.hintHtml}}"></i18n-html>
                </div>
                <div class="actions">
                    <pretty-button
                        *if="config.action"
                        variant="primary"
                        @click.stop.prevent="grant()"
                        ><span *if="busy" class="busy"></span
                        ><i18n-label
                            id="{{busy ? 'shared.access.checking' : config.action}}"
                            ws=""
                        ></i18n-label
                    ></pretty-button>
                    <pretty-button @click.stop.prevent="back()"
                        ><i18n-label id="shared.access.back" ws=""></i18n-label
                    ></pretty-button>
                </div>
            </div>
        `,
    },
    AccessScreenComponent
);
