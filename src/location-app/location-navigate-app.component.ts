import { Component, css, di, emit, html } from 'fudgel';
import { WakeLockService } from '../services/wake-lock.service';
import { WaypointSaved } from '../datatypes/waypoint-saved';
import { WaypointService } from './waypoint.service';

@Component('location-navigate-app', {
    attr: ['id'],
    style: css`
        .navigate {
            padding: 5px;
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
            gap: 10px;
        }

        .type-and-arrow {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            flex-grow: 1;
            text-align: center;
        }

        @media (orientation: portrait) {
            .type-and-arrow {
                width: 100%;
            }
        }

        @media (orientation: landscape) {
            .wrapper {
                flex-direction: row-reverse;
            }

            .buttons {
                flex-direction: column-reverse;
            }

            .content {
                flex-direction: row;
            }

            .type-and-arrow {
                height: 100%;
            }
        }

        .field {
            display: flex;
            max-width: 100%;
        }

        .fields {
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            max-width: 100%;
        }

        .navigation-arrow {
            flex-grow: 1;
            width: 100%;
        }

        .gap-above {
            padding-top: 0.4em;
        }
    `,
    template: html`
        <location-wrapper>
            <default-layout>
                <div class="content">
                    <div class="type-and-arrow">
                        <navigation-type></navigation-type>
                        <navigation-arrow
                            class="navigation-arrow"
                            lat="{{point.lat}}"
                            lon="{{point.lon}}"
                        ></navigation-arrow>
                    </div>
                    <div class="gap-above fields">
                        <div class="field">
                            <location-field
                                id="navigate.1"
                                default="DISTANCE"
                                lat="{{point.lat}}"
                                lon="{{point.lon}}"
                                name="{{point.name}}"
                            ></location-field>
                        </div>
                        <div class="field">
                            <location-field
                                id="navigate.2"
                                default="DESTINATION"
                                lat="{{point.lat}}"
                                lon="{{point.lon}}"
                                name="{{point.name}}"
                            ></location-field>
                        </div>
                        <div class="field">
                            <location-field
                                id="navigate.3"
                                default="SPEED"
                                lat="{{point.lat}}"
                                lon="{{point.lon}}"
                                name="{{point.name}}"
                            ></location-field>
                        </div>
                        <div class="field">
                            <location-field
                                id="navigate.4"
                                default="HEADING"
                                lat="{{point.lat}}"
                                lon="{{point.lon}}"
                                name="{{point.name}}"
                            ></location-field>
                        </div>
                        <div class="field">
                            <location-field
                                id="navigate.5"
                                default="ACCURACY"
                                lat="{{point.lat}}"
                                lon="{{point.lon}}"
                                name="{{point.name}}"
                            ></location-field>
                        </div>
                    </div>
                </div>
            </default-layout>
        </location-wrapper>
    `,
})
export class LocationNavigateAppComponent {
    private _wakeLockService = di(WakeLockService);
    private _waypointService = di(WaypointService);
    id?: string;
    point: WaypointSaved | null = null;

    onInit() {
        const id = this.id;

        if (id) {
            this.point = this._waypointService.getPoint(+id);
        }

        if (!this.point) {
            this.goBack();
        }

        this._wakeLockService.request();
    }

    onDestroy() {
        this._wakeLockService.release();
    }

    goBack() {
        emit(this, 'edit', this.id);
    }
}
