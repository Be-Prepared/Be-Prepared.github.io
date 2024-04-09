import { Component, css, di, html } from 'fudgel';
import { Subscription } from 'rxjs';
import { TileDefResolved, TileService } from '../services/tile.service';

@Component('app-index', {
    style: css`
        :host {
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
        }
    `,
    template: html`
        <div *for="tile of tiles">
            <app-index-tile
                id="{{tile.id}}"
                icon="{{tile.icon}}"
                label="{{tile.label}}"
            ></app-index-tile>
        </div>
    `,
})
export class AppIndex {
    #subscription?: Subscription;
    #tileService = di(TileService);
    tiles?: TileDefResolved[];

    constructor() {
        this.#subscription = this.#tileService
        .getAllowedTiles()
        .subscribe((tiles) => (this.tiles = tiles));
    }

    onDestroy() {
        if (this.#subscription) {
            this.#subscription.unsubscribe();
        }
    }
}
