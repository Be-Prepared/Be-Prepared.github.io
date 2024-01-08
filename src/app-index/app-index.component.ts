import { Component, css, di, html } from 'fudgel';
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
                    <div *for="tile of this.tiles">
                        <app-index-tile
                            id="{{$scope.tile.id}}"
                            icon="{{$scope.tile.icon}}"
                            label="{{$scope.tile.label}}"
                        ></app-index-tile>
                    </div>
    `
})
export class AppIndex {
    #tileService = di(TileService);
    tiles: TileDefResolved[] = [];

    onInit() {
        this.#tileService.getAllowedTiles().then((tiles) => this.tiles = tiles);
    }
}
