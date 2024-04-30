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
            <div path="/location-add" component="location-add-app"></div>
            <div path="/location-edit/:id" component="location-edit-app"></div>
            <div path="/location-list" component="location-list-app"></div>
            <div
                path="/location-navigate/:id"
                component="location-navigate-app"
            ></div>
            <div path="**" component="app-index"></div>
        </app-router>
    `,
})
export class AppRootComponent {
    private _subscription?: Subscription;
    private _tileService = di(TileService);
    tiles?: TileDefResolved[];

    constructor() {
        this._subscription = this._tileService
            .getAllowedTiles()
            .subscribe((tiles) => {
                this.tiles = tiles;
            });
    }

    onDestroy() {
        if (this._subscription) {
            this._subscription.unsubscribe();
        }
    }
}
