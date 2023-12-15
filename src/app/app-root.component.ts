import { Component, css, html } from 'fudgel';

@Component('app-root', {
    style: css`
        :host {
            display: block;
            height: 100%;
            width: 100%;
            overflow: none;
        }

        .wrapper {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            padding: 0.5em;
        }
    `,
    template: html`
        <div class="wrapper">
            <app-tile
                icon="flashlight.svg"
                label="tile.flashlight"
            ></app-tile>
            <app-tile
                icon="front-light.svg"
                label="tile.frontLight"
            ></app-tile>
            <app-tile
                icon="magnifier.svg"
                label="tile.magnifier"
            ></app-tile>
            <app-tile icon="mirror.svg" label="tile.mirror"></app-tile>
            <app-tile icon="compass.svg" label="tile.compass"></app-tile>
            <app-tile icon="gps.svg" label="tile.gps"></app-tile>
            <app-tile icon="qr.svg" label="tile.qr"></app-tile>
            <app-tile icon="nfc.svg" label="tile.nfc"></app-tile>
            <app-tile icon="info.svg" label="tile.info"></app-tile>
        </div>
    `,
})
export class AppRootComponent {}
