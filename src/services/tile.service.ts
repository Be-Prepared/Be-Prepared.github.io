import { applyOrder, isOrderList, mergeOrder } from '../app-index/tile-order';
import { BehaviorSubject, combineLatest, from, Observable, of } from 'rxjs';
import { catchError, map, shareReplay, timeout } from 'rxjs/operators';
import { LocalStorageService } from './local-storage.service';
import { TileDef, tileDefs } from '../tile-defs';

export type TileDefResolved = Omit<TileDef, 'hasHardware'>;

// Never let hardware detection hold up the home screen.
const DETECTION_TIMEOUT_MS = 1500;

// The person's own arrangement of the home screen. A layout preference,
// not a permission or hardware result.
const orderStorage = LocalStorageService.json<string[]>(
    'home.tileOrder',
    1,
    isOrderList
);

export class TileService {
    private _detected: Observable<TileDefResolved[]> | null = null;
    private _order = new BehaviorSubject<string[] | null>(
        orderStorage.getItem()
    );

    // Every tile, whether or not the hardware is present. Used for routing
    // so links to a tool always work.
    getAllTiles(): TileDefResolved[] {
        return tileDefs.map(({ hasHardware, ...tile }) => tile);
    }

    // Tiles to show on the home screen, in the person's order. Only tools
    // whose hardware is missing are hidden. Permissions are never looked at
    // here.
    getAvailableTiles(): Observable<TileDefResolved[]> {
        return combineLatest([this._detectHardware(), this._order]).pipe(
            map(([tiles, order]) => applyOrder(tiles, order))
        );
    }

    // Saves a new arrangement of the visible tiles. Hidden tiles keep their
    // place for when their hardware shows up.
    setVisibleOrder(visibleIds: string[]) {
        const order = mergeOrder(
            visibleIds,
            this._order.value,
            tileDefs.map((tile) => tile.id)
        );
        orderStorage.setItem(order);
        this._order.next(order);
    }

    resetOrder() {
        orderStorage.reset();
        this._order.next(null);
    }

    private _detectHardware() {
        if (!this._detected) {
            this._detected = from(
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

        return this._detected;
    }
}
