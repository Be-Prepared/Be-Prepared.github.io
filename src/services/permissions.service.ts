export type PermissionsServiceName = 'camera';

export class PermissionsService {
    camera() {
        return this.#getPermission('camera' as PermissionName);
    }

    #getPermission(name: PermissionName) {
        return window.navigator.permissions.query({
            name: name as unknown as PermissionName
        }).then((result) => {
            if (result.state === 'denied') {
                return false;
            }

            if (result.state === 'prompt') {
                return null;
            }

            return true;
        });
    }
}
