import { Observable } from 'rxjs';

export const enum PermissionStatus {
    GRANTED = 'GRANTED',
    DENIED = 'DENIED',
    PROMPT = 'PROMPT',

    // The browser can't tell us. Common on iOS and for newer permission
    // names. Attempting to use the feature is the only way to find out.
    UNKNOWN = 'UNKNOWN',
}

export function toPermissionStatus(state: string | undefined | null) {
    if (state === 'granted') {
        return PermissionStatus.GRANTED;
    }

    if (state === 'denied') {
        return PermissionStatus.DENIED;
    }

    if (state === 'prompt') {
        return PermissionStatus.PROMPT;
    }

    return PermissionStatus.UNKNOWN;
}

type VisibilityDocument = Pick<
    Document,
    'addEventListener' | 'removeEventListener' | 'visibilityState'
>;

// Reports the current state of a permission and any later changes, such as
// when the person re-enables it in the browser's settings. This never shows a
// prompt and nothing is cached between calls.
export function watchPermission(
    name: string,
    permissions: Permissions | undefined = typeof navigator === 'undefined'
        ? undefined
        : navigator.permissions,
    doc: VisibilityDocument | undefined = typeof document === 'undefined'
        ? undefined
        : document
): Observable<PermissionStatus> {
    return new Observable<PermissionStatus>((subscriber) => {
        let status: PermissionStatus | null = null;
        let permissionStatus: PermissionStatusLike | null = null;
        let closed = false;
        const emit = (value: PermissionStatus) => {
            if (value !== status) {
                status = value;
                subscriber.next(value);
            }
        };

        if (!permissions || !permissions.query) {
            emit(PermissionStatus.UNKNOWN);

            return;
        }

        const check = () => {
            let query: Promise<PermissionStatusLike>;

            try {
                query = permissions.query({ name: name as PermissionName });
            } catch (_ignore) {
                emit(PermissionStatus.UNKNOWN);

                return;
            }

            query.then(
                (result) => {
                    if (closed) {
                        return;
                    }

                    if (permissionStatus && permissionStatus !== result) {
                        permissionStatus.onchange = null;
                    }

                    permissionStatus = result;
                    emit(toPermissionStatus(result.state));

                    // iOS has poor support for onchange, but where it works
                    // it lets the UI react to changes made in the settings.
                    result.onchange = () =>
                        emit(toPermissionStatus(result.state));
                },
                () => emit(PermissionStatus.UNKNOWN)
            );
        };
        // Permissions are fixed in the Settings app or the browser's own
        // settings, and the person comes back afterwards. Browsers that
        // don't report the change (iOS) answer correctly when asked again.
        const visibilityListener = () => {
            if (doc?.visibilityState !== 'hidden') {
                check();
            }
        };

        doc?.addEventListener('visibilitychange', visibilityListener);
        check();

        return () => {
            closed = true;
            doc?.removeEventListener('visibilitychange', visibilityListener);

            if (permissionStatus) {
                permissionStatus.onchange = null;
            }
        };
    });
}

interface PermissionStatusLike {
    onchange: any;
    state: string;
}
