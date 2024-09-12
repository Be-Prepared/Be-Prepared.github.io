import { Component, css, html } from 'fudgel';
import { CoordinateService } from '../services/coordinate.service';
import { di } from '../di';
import { Subscription } from 'rxjs';
import { ToastService } from '../services/toast.service';
import { WaypointSaved } from '../datatypes/waypoint-saved';
import { WaypointService } from './waypoint.service';

@Component('location-edit-app', {
    attr: ['id'],
    style: css`
        .gapAbove {
            padding-top: 0.7em;
        }

        .centered-text {
            width: 100%;
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
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            overflow: hidden;
        }

        .actions {
            box-sizing: border-box;
            width: 100%;
            display: flex;
            justify-content: space-between;
        }

        .landscape-buttons {
            display: flex;
            justify-content: space-around;
            width: 100%;
            padding-top: 0.4em;
        }

        @media (orientation: portrait) {
            .landscape {
                display: none;
            }
        }

        @media (orientation: landscape) {
            .portrait {
                display: none;
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
            <default-layout *if="point">
                <div class="content">
                    <div class="actions">
                        <pretty-button @click="openQrCode()" padding="0px">
                            <mini-qr
                                content="geo:{{lat}},{{lon}}?q={{nameUrlEncode}}"
                            ></mini-qr>
                        </pretty-button>
                        <div class="centered-text landscape">
                            <i18n-label
                                id="location.edit.helpSave"
                            ></i18n-label>
                        </div>
                        <pretty-labeled-button
                            @click="averagePoint()"
                            class="portrait"
                            id="location.edit.average"
                        ></pretty-labeled-button>
                        <pretty-labeled-button
                            @click="deletePoint()"
                            class="portrait"
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
                        <div class="gapAbove centered-text portrait">
                            <i18n-label
                                id="location.edit.helpSave"
                            ></i18n-label>
                        </div>
                        <div class="landscape landscape-buttons">
                            <pretty-labeled-button
                                @click="deletePoint()"
                                id="location.edit.delete"
                            ></pretty-labeled-button>
                            <pretty-labeled-button
                                @click="averagePoint()"
                                id="location.edit.average"
                            ></pretty-labeled-button>
                        </div>
                    </div>
                </div>
                <scaling-icon
                    slot="more-buttons"
                    *if="validPoint"
                    @click.stop.prevent="navigate()"
                    href="/navigate.svg"
                ></scaling-icon>
            </default-layout>
            <show-modal *if="showQr" @clickoutside="closeQrCode()">
                <big-qr
                    @click="closeQrCode()"
                    content="geo:{{lat}},{{lon}}?q={{nameUrlEncode}}"
                ></big-qr>
            </show-modal>
        </location-wrapper>
    `,
})
export class LocationEditComponent {
    private _coordinateService = di(CoordinateService);
    private _subscription?: Subscription;
    private _toastService = di(ToastService);
    private _waypointService = di(WaypointService);
    id?: string;
    lat?: number;
    location: string = '';
    locationInput: any;
    lon?: number;
    nameUrlEncode: string = '';
    point: WaypointSaved | null = null;
    showQr = false;
    validPoint = false;

    onInit() {
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
        this._updatePointProperties();
        this._updateLocation();
        this.validPoint = true;
    }

    onDestroy() {
        this._subscription && this._subscription.unsubscribe();
    }

    averagePoint() {
        history.pushState(
            {},
            document.title,
            `/location-average/${this.point!.id}`
        );
    }

    closeQrCode() {
        this.showQr = false;
    }

    deletePoint() {
        this._waypointService.deletePoint(this.point!.id);
        history.go(-1);
    }

    locationChange(location: string) {
        this._coordinateService
            .fromString(location)
            .subscribe((convertedLocation) => {
                if (convertedLocation) {
                    this.point!.lat = convertedLocation.lat;
                    this.point!.lon = convertedLocation.lon;
                    this._updatePointProperties();
                    this._waypointService.updatePoint(this.point!);
                    this._updateLocation();
                    this.validPoint = true;
                } else {
                    this._toastService.popI18n('location.edit.badLocation');
                    this.validPoint = false;
                }
            });
    }

    nameChange(name: string) {
        this.point!.name = name;
        this._updatePointProperties();
        this._waypointService.updatePoint(this.point!);
    }

    navigate() {
        history.pushState(
            {},
            document.title,
            `/location-navigate/${this.point!.id}`
        );
    }

    openQrCode() {
        this.showQr = true;
    }

    private _updatePointProperties() {
        this.lat = this.point!.lat;
        this.lon = this.point!.lon;
        this.nameUrlEncode = encodeURIComponent(this.point!.name);
    }

    private _updateLocation() {
        const location = this._coordinateService.latLonToSystem(
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

        if (this.locationInput) {
            this.locationInput.value = this.location;
        }
    }
}
