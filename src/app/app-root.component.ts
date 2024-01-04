import { Component, css, html } from 'fudgel';
import { tileDefs } from './tile-defs';

interface TileDefResolved {
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
            .wrapper {
                width: 8em;
            }
        }

        @media (max-width: 30em) {
            .wrapper {
                width: 33%;
            }
        }

        @media (max-width: 20em) {
            .wrapper {
                width: 50%;
            }
        }

        @media (max-width: 10em) {
            .wrapper {
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
                <div *for="tile of this.tiles" class="wrapper">
                    <app-tile
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
    tiles: TileDefResolved[] = [];

    constructor() {
        this.tiles = [...tileDefs].filter((tile) => tile.show);
    }
}
