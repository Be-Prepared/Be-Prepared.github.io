import { Component, css, html } from 'fudgel';

interface Tile {
    elementName: string;
    id: string;
    icon: string;
    label: string;
    component: string;
    show: boolean;
}

@Component('app-root', {
    style: css`
        :host {
            display: block;
            height: 100%;
            width: 100%;
            overflow: none;
        }

        .index {
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
        }

        .wrapper {
            box-sizing: border-box;
            padding: 0.5em;
            display: flex;
            width: 10em;
        }

        @media (max-width: 60em) {
            wrapper {
                width: 8em;
            }
        }

        @media (max-width: 30em) {
            wrapper {
                width: 33%;
            }
        }

        @media (max-width: 20em) {
            wrapper {
                width: 50%;
            }
        }

        @media (max-width: 10em) {
            wrapper {
                width: 100%;
            }
        }
    `,
    template: html`
        <app-router>
            <div
                *for="tile of this.tiles"
                path="/{{$scope.tile.id}}"
                component="{{$scope.tile.component}}"
            ></div>
            <div path="**" class="index">
                <div *for="tile of this.tiles">
                    <app-tile
                        *if="$scope.tile.show"
                        class="wrapper"
                        id="{{$scope.tile.id}}"
                        icon="{{$scope.tile.icon}}"
                        label="{{$scope.tile.label}}"
                    ></app-tile>
                </div>
            </div>
        </app-router>
    `,
})
export class AppRootComponent {
    tiles: Tile[] = [
        {
            elementName: '',
            id: 'flashlight',
            icon: 'flashlight.svg',
            label: 'tile.flashlight',
            component: 'app-flashlight',
            show: false
        },
        {
            elementName: '',
            id: 'frontLight',
            icon: 'front-light.svg',
            label: 'tile.frontLight',
            component: 'app-front-light',
            show: true
        },
        {
            elementName: '',
            id: 'magnifier',
            icon: 'magnifier.svg',
            label: 'tile.magnifier',
            component: 'app-magnifier',
            show: false
        },
        {
            elementName: '',
            id: 'mirror',
            icon: 'mirror.svg',
            label: 'tile.mirror',
            component: 'app-mirror',
            show: false
        },
        {
            elementName: '',
            id: 'compass',
            icon: 'compass.svg',
            label: 'tile.compass',
            component: 'app-compass',
            show: false
        },
        {
            elementName: '',
            id: 'location',
            icon: 'location.svg',
            label: 'tile.location',
            component: 'app-location',
            show: false
        },
        {
            elementName: '',
            id: 'qrCode',
            icon: 'qr-code.svg',
            label: 'tile.qrCode',
            component: 'app-qr-code',
            show: false
        },
        {
            elementName: '',
            id: 'nfc',
            icon: 'nfc.svg',
            label: 'tile.nfc',
            component: 'app-nfc',
            show: false
        },
        {
            elementName: '',
            id: 'timer',
            icon: 'timer.svg',
            label: 'tile.timer',
            component: 'app-timer',
            show: false
        },
        {
            elementName: '',
            id: 'metal-detector',
            icon: 'metal-detector.svg',
            label: 'tile.metalDetector',
            component: 'app-metal-detector',
            show: false
        },
        {
            elementName: '',
            id: 'speed',
            icon: 'speed.svg',
            label: 'tile.speed',
            component: 'app-speed',
            show: false
        },
        {
            elementName: '',
            id: 'level',
            icon: 'level.svg',
            label: 'tile.level',
            component: 'app-level',
            show: false
        },
        {
            elementName: '',
            id: 'stopwatch',
            icon: 'stopwatch.svg',
            label: 'tile.stopwatch',
            component: 'app-stopwatch',
            show: false
        },
        {
            elementName: '',
            id: 'temperature',
            icon: 'temperature.svg',
            label: 'tile.temperature',
            component: 'app-temperature',
            show: false
        },
        {
            elementName: '',
            id: 'info',
            icon: 'info.svg',
            label: 'tile.info',
            component: 'app-info',
            show: true
        },
    ];
}
