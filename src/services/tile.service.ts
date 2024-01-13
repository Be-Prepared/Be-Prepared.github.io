import { combineLatest, Observable, of, ReplaySubject } from 'rxjs';
import { di } from 'fudgel';
import { map } from 'rxjs/operators';
import { PermissionsService, PermissionsServiceState } from './permissions.service';
import { TileDef, tileDefs } from '../tile-defs';

export interface TileDefResolved {
    id: string;
    icon: string;
    label: string;
    component: string;
    show: boolean;
}

export class TileService {
    #permissionsService = di(PermissionsService);
    #subject = new ReplaySubject<TileDefResolved[]>(1);

    constructor() {
        this.#updateTiles();
    }

    getAllowedTiles() {
        return this.#subject.asObservable();
    }

    #lookupTilePermission(tile: TileDef): Observable<TileDefResolved> {
        if (!Array.isArray(tile.show)) {
            return of(tile as TileDefResolved);
        }

        return combineLatest(
            tile.show.map((name) => this.#permissionsService[name]())
        ).pipe(
            map((results) => {
                for (const result of results) {
                    if (result !== PermissionsServiceState.GRANTED && result !== PermissionsServiceState.PROMPT) {
                        return false;
                    }
                }

                return true;
            }),
            map((show) => {
                const resolved: TileDefResolved = {
                    ...tile,
                    show,
                };

                return resolved;
            })
        );
    }

    #updateTiles() {
        return combineLatest(
            tileDefs.map((tile) => this.#lookupTilePermission(tile))
        ).subscribe((tilesWithResults) => {
            this.#subject.next(tilesWithResults.filter((tile) => tile.show));
        });
    }
}
