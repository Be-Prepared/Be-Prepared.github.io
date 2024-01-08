import { Component, css, di, html } from 'fudgel/dist/fudgel.js';
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
        <app-router *if="this.tiles">
            <div
                *for="tile of this.tiles"
                path="/{{$scope.tile.id}}"
                component="{{$scope.tile.component}}"
            ></div>
            <div path="**" component="app-index"></div>
        </app-router>
    `,
})
export class AppRootComponent {
    tiles: TileDefResolved[] | null = null;
    #tileService = di(TileService);

    constructor() {
        this.#tileService
            .getAllowedTiles()
            .then((tiles) => (this.tiles = tiles));
    }
}
