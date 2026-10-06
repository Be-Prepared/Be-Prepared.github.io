import { component, css, html } from 'fudgel';
import { di } from '../di';
import { TileService } from '../services/tile.service';

export class AppRootComponent {
    tiles = di(TileService).getAllTiles();
}

component('app-root', {
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
            <div path="/location-add/:geo" component="location-add-app"></div>
            <div path="/location-add" component="location-add-app"></div>
            <div
                path="/location-average/:id"
                component="location-average-app"
            ></div>
            <div path="/location-edit/:id" component="location-edit-app"></div>
            <div path="/location-list" component="location-list-app"></div>
            <div
                path="/location-navigate/:id"
                component="location-navigate-app"
            ></div>
            <!-- File transfer frames start with this short URL, so a phone camera opens the receiver -->
            <div path="/r" component="file-transfer-receive-app"></div>
            <div path="/file-transfer-send" component="file-transfer-send-app"></div>
            <div path="**" component="app-index"></div>
        </app-router>
    `,
}, AppRootComponent);
