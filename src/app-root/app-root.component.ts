import { Component, css, di, html } from 'fudgel';
import { Subscription } from 'rxjs';
import { TileDefResolved, TileService } from '../services/tile.service';

@Component('app-root', {
    style: css`
        :host {
            display: block;
            height: 100%;
            width: 100%;
        }
    `,
    template: html`
        <app-router *if="tiles">
            <div
                *for="tile of tiles"
                path="/{{tile.id}}"
                component="{{tile.component}}"
            ></div>
            <div path="**" component="app-index"></div>
        </app-router>
    `,
})
export class AppRootComponent {
    #subscription?: Subscription;
    #tileService = di(TileService);
    tiles?: TileDefResolved[];

    constructor() {
        this.#subscription = this.#tileService
            .getAllowedTiles()
            .subscribe((tiles) => {
                this.tiles = tiles;
            });
    }

    onDestroy() {
        if (this.#subscription) {
            this.#subscription.unsubscribe();
        }
    }
}
