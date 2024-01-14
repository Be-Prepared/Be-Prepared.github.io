import { combineLatest, Observable, ReplaySubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { TileDef, tileDefs } from '../tile-defs';

export interface TileDefResolved {
    id: string;
    icon: string;
    label: string;
    component: string;
    show: boolean;
}

export class TileService {
    #subject = new ReplaySubject<TileDefResolved[]>(1);

    constructor() {
        this.#updateTiles();
    }

    getAllowedTiles() {
        return this.#subject.asObservable();
    }

    #lookupTilePermission(tile: TileDef): Observable<TileDefResolved> {
        return tile.show.pipe(
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
