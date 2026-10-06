import { from, Observable, of } from 'rxjs';
import { catchError, map, shareReplay, timeout } from 'rxjs/operators';
import { TileDef, tileDefs } from '../tile-defs';

export type TileDefResolved = Omit<TileDef, 'hasHardware'>;

// Never let hardware detection hold up the home screen.
const DETECTION_TIMEOUT_MS = 1500;

export class TileService {
    private _observable: Observable<TileDefResolved[]> | null = null;

    // Every tile, whether or not the hardware is present. Used for routing
    // so links to a tool always work.
    getAllTiles(): TileDefResolved[] {
        return tileDefs.map(({ hasHardware, ...tile }) => tile);
    }

    // Tiles to show on the home screen. Only tools whose hardware is missing
    // are hidden. Permissions are never looked at here.
    getAvailableTiles() {
        if (!this._observable) {
            this._observable = from(
                Promise.all(
                    tileDefs.map((tile) =>
                        Promise.resolve()
                            .then(() => tile.hasHardware())
                            .catch(() => true)
                    )
                )
            ).pipe(
                timeout(DETECTION_TIMEOUT_MS),
                map((results) =>
                    this.getAllTiles().filter((_tile, index) => results[index])
                ),
                catchError(() => of(this.getAllTiles())),
                shareReplay(1)
            );
        }

        return this._observable;
    }
}
