export type PermissionsServiceName = 'camera';

export class PermissionsService {
    camera() {
        return this.#getPermission('camera' as PermissionName);
    }

    #getPermission(name: PermissionName): Promise<PermissionState> {
        return window.navigator.permissions.query({
            name: name as unknown as PermissionName
        }).then((result) => result.state);
    }
}
