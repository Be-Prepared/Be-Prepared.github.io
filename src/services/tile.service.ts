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
    private _subject = new ReplaySubject<TileDefResolved[]>(1);

    constructor() {
        this._updateTiles();
    }

    getAllowedTiles() {
        return this._subject.asObservable();
    }

    private _lookupTilePermission(tile: TileDef): Observable<TileDefResolved> {
        return tile.show.pipe(
            map((show) => {
                const resolved: TileDefResolved = {
                    ...tile,
                    show,
                };

                return resolved;
            }),
        );
    }

    private _updateTiles() {
        return combineLatest(
            tileDefs.map((tile) => this._lookupTilePermission(tile)),
        ).subscribe((tilesWithResults) => {
            this._subject.next(tilesWithResults.filter((tile) => tile.show));
        });
    }
}
