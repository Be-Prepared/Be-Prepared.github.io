import { Component, css, di, html } from 'fudgel';
import { CoordinateService } from '../services/coordinate.service';
import { GeolocationService } from '../services/geolocation.service';
import { Subscription } from 'rxjs';
import { ToastService } from '../services/toast.service';
import { WaypointSaved } from '../datatypes/waypoint-saved';
import { WaypointService } from './waypoint.service';

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

        .centered-text {
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
            padding: 8px 8px 0 8px;
            width: 100%;
            display: flex;
            justify-content: space-between;
        }

        @media (orientation: landscape) {
            .wrapper {
                flex-direction: row-reverse;
            }

            .buttons {
                flex-direction: column-reverse;
            }
        }

        .no-shrink {
            flex-shrink: 0;
        }

        .space-between-bottom {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
        }

        .full-width {
            width: 100%;
        }
    `,
    template: html`
        <location-wrapper>
            <div class="wrapper" *if="point">
                <div class="content">
                    <div class="delete">
                        <pretty-button @click="openQrCode()" padding="0px">
                            <mini-qr content="geo:{{lat}},{{lon}}"></mini-qr>
                        </pretty-button>
                        <pretty-labeled-button
                            @click="deletePoint()"
                            id="location.edit.delete"
                        ></pretty-labeled-button>
                    </div>
                    <div class="detail">
                        <div class="full-width">
                            <div class="no-shrink">
                                <i18n-label
                                    id="location.edit.name"
                                ></i18n-label>
                            </div>
                            <pretty-input
                                class="full-width"
                                value="{{point.name}}"
                                @change="nameChange($event.detail)"
                            ></pretty-input>
                        </div>
                        <div class="full-width gapAbove">
                            <div class="no-shrink space-between-bottom">
                                <i18n-label
                                    id="location.edit.location"
                                ></i18n-label>
                            </div>
                            <pretty-input
                                class="full-width"
                                value="{{location}}"
                                @change="locationChange($event.detail)"
                                #ref="locationInput"
                                help-html="location.help.html"
                            ></pretty-input>
                        </div>
                        <div class="gapAbove centered-text">
                            <i18n-label
                                id="location.edit.helpSave"
                            ></i18n-label>
                        </div>
                    </div>
                </div>
                <div class="buttons">
                    <back-button></back-button>
                    <scaling-icon
                        *if="validPoint"
                        class="navigate"
                        @click.stop.prevent="navigate()"
                        href="/navigate.svg"
                    ></scaling-icon>
                </div>
            </div>
        </location-wrapper>
    `,
})
export class LocationEditComponent {
    private _coordinateService = di(CoordinateService);
    private _geolocationService = di(GeolocationService);
    private _subscription?: Subscription;
    private _toastService = di(ToastService);
    private _waypointService = di(WaypointService);
    id?: string;
    lat?: number;
    location: string = '';
    locationInput: any;
    lon?: number;
    point: WaypointSaved | null = null;
    validPoint = false;

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
        this._updateLatLon();
        this._updateLocation();
        this.validPoint = true;
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
            this._updateLatLon();
            this._waypointService.updatePoint(this.point!);
            this._updateLocation();
            this.validPoint = true;
        } else {
            this._toastService.popI18n('location.edit.badLocation');
            this.validPoint = false;
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

    openQrCode() {
        history.pushState(
            {},
            document.title,
            `/location-qr/${this.point!.id}`,
        );
    }

    private _updateLatLon() {
        this.lat = this.point!.lat;
        this.lon = this.point!.lon;
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

        if (this.locationInput) {
            this.locationInput.value = this.location;
        }
    }
}
