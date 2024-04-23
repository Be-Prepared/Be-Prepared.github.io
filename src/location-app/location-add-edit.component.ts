import { Component, css, di, emit, html } from 'fudgel';
import { CoordinateService } from '../services/coordinate.service';
import { WaypointSaved, WaypointService } from './waypoint.service';

@Component('location-add-edit', {
    attr: ['id'],
    style: css`
        .wrapper {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
        }

        .buttons {
            display: flex;
            flex-direction: row;
            justify-content: space-between;
        }

        .navigate {
            padding: 5px;
        }

        .gapAbove {
            padding-top: 0.7em;
        }

        .centeredText {
            text-align: center;
        }

        .content {
            height: 100%;
            width: 100%;
            padding: 1em;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            box-sizing: border-box;
            overflow: hidden;
            font-size: 3em;
        }

        @media (max-width: 960px) {
            .content {
                font-size: 2.5em;
            }
        }

        @media (max-width: 720px) {
            .content {
                font-size: 1.8em;
            }
        }

        @media (max-width: 480px) {
            .content {
                font-size: 1.3em;
            }
        }

        @media (max-width: 360px) {
            .content {
                font-size: 1em;
            }
        }

        @media (orientation: landscape) {
            .wrapper {
                flex-direction: row-reverse;
            }

            .buttons {
                flex-direction: column-reverse;
            }
        }

        input {
            font: inherit;
        }
    `,
    template: html`
        <div class="wrapper" *if="point">
            <div class="content">
                <div><i18n-label id="location.addEdit.name"></i18n-label></div>
                <div>
                    <input
                        type="text"
                        value="{{point.name}}"
                        @change="nameChange($event.target.value)"
                    />
                </div>
                <div class="gapAbove">
                    <i18n-label id="location.addEdit.location"></i18n-label>
                </div>
                <div>
                    <input
                        type="text"
                        value="{{location}}"
                        @change="nameChange($event.target.value)"
                    />
                </div>
                <div class="gapAbove centeredText">
                    <i18n-label id="location.addEdit.help"></i18n-label>
                </div>
            </div>
            <div class="buttons">
                <back-button emit="list"></back-button>
                <scaling-icon
                    class="navigate"
                    @click.stop.prevent="navigate()"
                    href="./compass-icon.svg"
                ></scaling-icon>
            </div>
        </div>
    `,
})
export class LocationAddEditComponent {
    #coordinateService = di(CoordinateService);
    #waypointService = di(WaypointService);
    id?: string;
    location: string = '';
    point: WaypointSaved | null = null;

    onInit() {
        const id = this.id;

        if (!id) {
            this.point = this.#waypointService.newPoint();
        } else {
            const point = this.#waypointService.getPoint(+id);

            this.point = point || this.#waypointService.newPoint();
        }

        this.#updateLocation();
    }

    nameChange(name: string) {
        this.point!.name = name;
        this.#waypointService.updatePoint(this.point!);
    }

    navigate() {
        emit(this, 'navigate', this.id);
    }

    #updateLocation() {
        const location = this.#coordinateService.latLonToSystem(
            this.point!.lat,
            this.point!.lon
        );

        if ('mgrs' in location) {
            this.location = location.mgrs;
        } else if ('utmups' in location) {
            this.location = location.utmups;
        } else {
            this.location = location.latLon;
        }
    }
}
