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

        @media (orientation: landscape) {
            .wrapper {
                flex-direction: row-reverse;
            }

            .buttons {
                flex-direction: column-reverse;
            }

            .landscape-side-by-side {
                display: flex;
                flex-direction: row;
                whitespace: no-wrap;
                width: 100%;
                gap: 10px;
                align-items: center;
            }
        }

        .no-shrink {
            flex-shrink: 0;
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
                        <div class="landscape-side-by-side">
                            <div class="no-shrink">
                                <i18n-label
                                    id="location.addEdit.name"
                                ></i18n-label>
                            </div>
                            <div class="fullWidth">
                                <input
                                    type="text"
                                    value="{{point.name}}"
                                    @change="nameChange($event.target.value)"
                                />
                            </div>
                        </div>
                        <div class="landscape-side-by-side gapAbove">
                            <div class="no-shrink">
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
                        </div>
                        <div class="gapAbove centeredText">
                            <i18n-label
                                id="location.addEdit.helpSave"
                            ></i18n-label>
                        </div>
                        <div class="gapAbove centeredText">
                            <i18n-label
                                id="location.addEdit.helpCoordinates"
                            ></i18n-label>
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
    private _coordinateService = di(CoordinateService);
    private _geolocationService = di(GeolocationService);
    private _subscription?: Subscription;
    private _waypointService = di(WaypointService);
    id?: string;
    location: string = '';
    point: WaypointSaved | null = null;

    onInit() {
        this._subscription = this._geolocationService
            .getPosition()
            .subscribe(() => {
                // Empty, but keeps the GPS active
            });
        const id = this.id;
        let point;

        if (id) {
            point = this._waypointService.getPoint(+id);
        }

        if (!point) {
            history.go(-1);
            return;
        }

        this.point = point;
        this._updateLocation();
    }

    onDestroy() {
        this._subscription && this._subscription.unsubscribe();
    }

    deletePoint() {
        this._waypointService.deletePoint(this.point!.id);
        history.go(-1);
    }

    locationChange(location: string) {
        const convertedLocation = this._coordinateService.fromString(location);

        if (convertedLocation) {
            this.point!.lat = convertedLocation.lat;
            this.point!.lon = convertedLocation.lon;
            this._waypointService.updatePoint(this.point!);
        }
    }

    nameChange(name: string) {
        this.point!.name = name;
        this._waypointService.updatePoint(this.point!);
    }

    navigate() {
        history.pushState(
            {},
            document.title,
            `/location-navigate/${this.point!.id}`,
        );
    }

    private _updateLocation() {
        const location = this._coordinateService.latLonToSystem(
            this.point!.lat,
            this.point!.lon,
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
