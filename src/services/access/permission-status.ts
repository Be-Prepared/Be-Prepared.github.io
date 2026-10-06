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

// Reports the current state of a permission and any later changes, such as
// when the person re-enables it in the browser's settings. This never shows a
// prompt and nothing is cached between calls.
export function watchPermission(
    name: string,
    permissions: Permissions | undefined = typeof navigator === 'undefined'
        ? undefined
        : navigator.permissions
): Observable<PermissionStatus> {
    return new Observable<PermissionStatus>((subscriber) => {
        let status: PermissionStatus | null = null;
        let permissionStatus: { onchange: any; state: string } | null = null;
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

                permissionStatus = result;
                emit(toPermissionStatus(result.state));

                // iOS has poor support for onchange, but where it works it
                // lets the UI react to changes made in the settings.
                result.onchange = () => emit(toPermissionStatus(result.state));
            },
            () => emit(PermissionStatus.UNKNOWN)
        );

        return () => {
            closed = true;

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
