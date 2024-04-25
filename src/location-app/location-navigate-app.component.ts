import { Component, css, di, emit, html } from 'fudgel';
import { WaypointSaved, WaypointService } from './waypoint.service';

@Component('location-navigate-app', {
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

        .fullWidth {
            width: 100%;
        }

        .fields {
            overflow: hidden;
            width: 100%;
        }

        .navigationArrow {
            flex-grow: 1;
            width: 100%;
        }

        .gapAbove {
            padding-top: 0.4em;
        }
    `,
    template: html`
        <div class="wrapper">
            <div class="content">
                <navigation-type></navigation-type>
                <navigation-arrow
                    class="navigationArrow"
                    lat="{{point.lat}}"
                    lon="{{point.lon}}"
                ></navigation-arrow>
                <div class="gapAbove fields">
                    <div class="fullWidth">
                        <location-field
                            id="navigate.1"
                            default="DISTANCE"
                            lat="{{point.lat}}"
                            lon="{{point.lon}}"
                            name="{{point.name}}"
                        ></location-field>
                    </div>
                    <div class="fullWidth">
                        <location-field
                            id="navigate.2"
                            default="DESTINATION"
                            lat="{{point.lat}}"
                            lon="{{point.lon}}"
                            name="{{point.name}}"
                        ></location-field>
                    </div>
                    <div class="fullWidth">
                        <location-field
                            id="navigate.3"
                            default="SPEED"
                            lat="{{point.lat}}"
                            lon="{{point.lon}}"
                            name="{{point.name}}"
                        ></location-field>
                    </div>
                    <div class="fullWidth">
                        <location-field
                            id="navigate.4"
                            default="HEADING"
                            lat="{{point.lat}}"
                            lon="{{point.lon}}"
                            name="{{point.name}}"
                        ></location-field>
                    </div>
                    <div class="fullWidth">
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
            <div class="buttons">
                <back-button
                    @back.stop.prevent="goBack()"
                    emit="back"
                ></back-button>
            </div>
        </div>
    `,
})
export class LocationNavigateAppComponent {
    #waypointService = di(WaypointService);
    id?: string;
    point: WaypointSaved | null = null;

    onInit() {
        const id = this.id;

        if (id) {
            this.point = this.#waypointService.getPoint(+id);
        }

        if (!this.point) {
            this.goBack();
        }
    }

    goBack() {
        emit(this, 'edit', this.id);
    }
}
