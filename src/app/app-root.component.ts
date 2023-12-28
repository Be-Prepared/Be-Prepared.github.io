import { Component, css, di, html } from 'fudgel';

interface Tile {
    elementName: string;
    id: string;
    icon: string;
    label: string;
}

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
        <app-router>
            <div *for="tile of this.tiles" path="/{{$scope.tile.id}}">{{$scope.tile.id}}</div>
            <div path="**">
                <app-tile
                    *for="tile of this.tiles"
                    id="{{$scope.tile.id}}"
                    icon="{{$scope.tile.icon}}"
                    label="{{$scope.tile.label}}"
                ></app-tile>
            </div>
        </app-router>
    `,
})
export class AppRootComponent {
    tiles: Tile[] = [
        {
            elementName: "",
            id: "flashlight",
            icon: 'flashlight.svg',
            label: 'tile.flashlight',
        },
        {
            elementName: "",
            id: "frontLight",
            icon: 'front-light.svg',
            label: 'tile.frontLight',
        },
        {
            elementName: "",
            id: "magnifier",
            icon: 'magnifier.svg',
            label: 'tile.magnifier',
        },
        {
            elementName: "",
            id: "mirror",
            icon: 'mirror.svg',
            label: 'tile.mirror',
        },
        {
            elementName: "",
            id: "compass",
            icon: 'compass.svg',
            label: 'tile.compass',
        },
        {
            elementName: "",
            id: "location",
            icon: 'location.svg',
            label: 'tile.location',
        },
        {
            elementName: "",
            id: "qrCode",
            icon: 'qr-code.svg',
            label: 'tile.qrCode',
        },
        {
            elementName: "",
            id: "nfc",
            icon: 'nfc.svg',
            label: 'tile.nfc',
        },
        {
            elementName: "",
            id: "timer",
            icon: 'timer.svg',
            label: 'tile.timer',
        },
        {
            elementName: "",
            id: "metal-detector",
            icon: 'metal-detector.svg',
            label: 'tile.metalDetector',
        },
        {
            elementName: "",
            id: "speed",
            icon: 'speed.svg',
            label: 'tile.speed',
        },
        {
            elementName: "",
            id: "level",
            icon: 'level.svg',
            label: 'tile.level',
        },
        {
            elementName: "",
            id: "stopwatch",
            icon: 'stopwatch.svg',
            label: 'tile.stopwatch',
        },
        {
            elementName: "",
            id: "temperature",
            icon: 'temperature.svg',
            label: 'tile.temperature',
        },
        {
            elementName: "",
            id: "info",
            icon: 'info.svg',
            label: 'tile.info',
        },
    ];
    #tool?: HTMLElement;
}
