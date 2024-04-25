import { Component, css, di, html } from 'fudgel';
import { CoordinateService } from '../services/coordinate.service';
import { GeolocationService } from '../services/geolocation.service';
import { Subscription } from 'rxjs';
import { WaypointSaved, WaypointService } from './waypoint.service';

@Component('location-edit-app', {
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
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
            font-size: 3em;
        }

        .detail {
            height: 100%;
            width: 100%;
            padding: 1em;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            overflow: hidden;
        }

        .delete {
            box-sizing: border-box;
            padding: 8px 8px 0 0;
            width: 100%;
            display: flex;
            justify-content: flex-end;
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
            width: 100%;
            text-align: center;
        }

        .fullWidth {
            width: 100%;
        }
    `,
    template: html`
        <location-wrapper>
            <div class="wrapper" *if="point">
                <div class="content">
                    <div class="delete">
                        <pretty-button
                            @click="deletePoint()"
                            id="location.addEdit.delete"
                        ></pretty-button>
                    </div>
                    <div class="detail">
                        <div>
                            <i18n-label id="location.addEdit.name"></i18n-label>
                        </div>
                        <div class="fullWidth">
                            <input
                                type="text"
                                value="{{point.name}}"
                                @change="nameChange($event.target.value)"
                            />
                        </div>
                        <div class="gapAbove">
                            <i18n-label
                                id="location.addEdit.location"
                            ></i18n-label>
                        </div>
                        <div class="fullWidth">
                            <input
                                type="text"
                                value="{{location}}"
                                @change="locationChange($event.target.value)"
                            />
                        </div>
                        <div class="gapAbove centeredText">
                            <i18n-label id="location.addEdit.helpSave"></i18n-label>
                        </div>
                        <div class="gapAbove centeredText">
                            <i18n-label id="location.addEdit.helpCoordinates"></i18n-label>
                        </div>
                    </div>
                </div>
                <div class="buttons">
                    <back-button></back-button>
                    <scaling-icon
                        class="navigate"
                        @click.stop.prevent="navigate()"
                        href="/navigate.svg"
                    ></scaling-icon>
                </div>
            </div>
        </location-wrapper>
    `,
})
export class LocationAddEditComponent {
    #coordinateService = di(CoordinateService);
    #geolocationService = di(GeolocationService);
    #subscription?: Subscription;
    #waypointService = di(WaypointService);
    id?: string;
    location: string = '';
    point: WaypointSaved | null = null;

    onInit() {
        this.#subscription = this.#geolocationService.getPosition().subscribe(() => {
            // Empty, but keeps the GPS active
        });
        const id = this.id;
        let point;

        if (id) {
            point = this.#waypointService.getPoint(+id);
        }

        if (!point) {
            history.go(-1);
            return;
        }

        this.point = point;
        this.#updateLocation();
    }

    onDestroy() {
        this.#subscription && this.#subscription.unsubscribe();
    }

    deletePoint() {
        this.#waypointService.deletePoint(this.point!.id);
        history.go(-1);
    }

    locationChange(location: string) {
        const convertedLocation = this.#coordinateService.fromString(location);

        if (convertedLocation) {
            this.point!.lat = convertedLocation.lat;
            this.point!.lon = convertedLocation.lon;
            this.#waypointService.updatePoint(this.point!);
        }
    }

    nameChange(name: string) {
        this.point!.name = name;
        this.#waypointService.updatePoint(this.point!);
    }

    navigate() {
        history.pushState(
            {},
            document.title,
            `/location-navigate/${this.point!.id}`
        );
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
