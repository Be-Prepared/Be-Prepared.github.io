import { di } from 'fudgel';
import { PermissionsService } from './permissions.service';
import { tileDefs } from '../tile-defs';

export interface TileDefResolved {
    id: string;
    icon: string;
    label: string;
    component: string;
    show: boolean;
}

export class TileService {
    #permissionsService = di(PermissionsService);
    #promise: Promise<TileDefResolved[]> = this.#updateTiles();

    getAllowedTiles() {
        return this.#promise;
    }

    update() {
        this.#promise = this.#updateTiles();
    }

    #lookupPermission(
        name: string,
        permissionsMap: Map<string, Promise<boolean>>
    ) {
        const previousPromise = permissionsMap.get(name);

        if (previousPromise) {
            return previousPromise;
        }

        const newPromise = this.#permissionsService[name]();
        permissionsMap.set(name, newPromise);

        return newPromise;
    }

    #lookupTile(
        permissions: string[],
        permissionsMap: Map<string, Promise<boolean>>
    ) {
        return Promise.all(
            permissions.map((name: string) =>
                this.#lookupPermission(name, permissionsMap)
            )
        ).then((permissionResults: boolean[]) => {
            if (permissionResults.includes(false)) {
                return false;
            }

            return true;
        });
    }

    #updateTiles() {
        const permissionsMap = new Map<string, Promise<boolean>>();

        return Promise.all(
            tileDefs.map((tile) => {
                if (Array.isArray(tile.show)) {
                    return this.#lookupTile(tile.show, permissionsMap).then(
                        (show) => {
                            const resolved: TileDefResolved = {
                                ...tile,
                                show,
                            };

                            return resolved;
                        }
                    );
                }

                return tile as TileDefResolved;
            })
        ).then((tileResults: TileDefResolved[]) => {
            return tileResults.filter((tile) => tile.show);
        });
    }
}
