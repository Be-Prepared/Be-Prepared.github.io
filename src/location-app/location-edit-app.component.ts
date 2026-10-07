import { component, css, html } from 'fudgel';
import { CoordinateService } from '../services/coordinate.service';
import { di } from '../di';
import { Subscription } from 'rxjs';
import { ReferenceLocationService } from '../services/reference-location.service';
import { ToastService } from '../services/toast.service';
import { WaypointSaved } from '../datatypes/waypoint-saved';
import { WaypointService } from './waypoint.service';

export class LocationEditComponent {
    private _coordinateService = di(CoordinateService);
    private _parseSubscription?: Subscription;
    private _referenceLocationService = di(ReferenceLocationService);
    private _subscription?: Subscription;
    private _toastService = di(ToastService);
    private _waypointService = di(WaypointService);
    gettingLocation = false;
    id?: string;
    lat?: number;
    location: string = '';
    locationInput: any;
    lon?: number;
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
        this._parseSubscription && this._parseSubscription.unsubscribe();
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
        this._parseSubscription && this._parseSubscription.unsubscribe();
        // Shorthand like "UJ 2337 0651" is completed using where you are.
        this._parseSubscription = this._referenceLocationService
            .parseLocation(location, (isWaiting) => {
                this.gettingLocation = isWaiting;
            })
            .subscribe(({ latLon, missingReference }) => {
                if (latLon) {
                    this.point!.lat = latLon.lat;
                    this.point!.lon = latLon.lon;
                    this._updatePointProperties();
                    this._waypointService.updatePoint(this.point!);
                    this._updateLocation();
                    this.validPoint = true;
                } else {
                    this._toastService.popI18n(
                        missingReference
                            ? 'location.needReference'
                            : 'location.edit.badLocation'
                    );
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
        } else if ('pluscode' in location) {
            this.location = location.pluscode;
        } else {
            this.location = location.latLon;
        }

        if (this.locationInput) {
            this.locationInput.value = this.location;
        }
    }
}

component('location-edit-app', {
    attr: ['id'],
    style: css`
        .content {
            /* Location screens scale their text up; a form doesn't need to. */
            font-size: 1.125rem;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: var(--space-4);
            box-sizing: border-box;
            width: 100%;
            max-width: 32rem;
            min-height: 100%;
            margin: 0 auto;
            padding: var(--space-4);
        }

        .field {
            display: flex;
            flex-direction: column;
            gap: var(--space-1);
            /* Lets long coordinates shrink instead of widening the page. */
            min-width: 0;
        }

        .label {
            font-size: 0.85em;
            color: var(--fg-muted);
        }

        pretty-input {
            width: 100%;
            min-width: 0;
        }

        .help {
            font-size: 0.85em;
            color: var(--fg-muted);
            text-align: center;
        }

        .getting-location {
            padding: var(--space-3);
            border: 1px solid var(--border);
            border-radius: var(--radius-m);
            background-color: var(--surface);
        }
    `,
    template: html`
        <location-wrapper>
            <default-layout *if="point">
                <div class="content">
                    <div class="field">
                        <span class="label"
                            ><i18n-label id="location.edit.name" ws=""></i18n-label
                        ></span>
                        <pretty-input
                            value="{{point.name}}"
                            @change="nameChange($event.detail)"
                        ></pretty-input>
                    </div>
                    <div class="field">
                        <span class="label"
                            ><i18n-label
                                id="location.edit.location"
                                ws=""
                            ></i18n-label
                        ></span>
                        <pretty-input
                            value="{{location}}"
                            @change="locationChange($event.detail)"
                            #ref="locationInput"
                            help-html="location.help.html"
                        ></pretty-input>
                    </div>
                    <div class="help">
                        <i18n-label id="location.edit.helpSave" ws=""></i18n-label>
                    </div>
                </div>
                <icon-button
                    slot="more-buttons"
                    *if="validPoint"
                    @click.stop.prevent="navigate()"
                    href="/navigate.svg"
                    label-id="location.navigate"
                ></icon-button>
                <icon-button
                    slot="more-buttons"
                    @click.stop.prevent="openQrCode()"
                    href="/share-1.svg"
                    label-id="location.share.button"
                ></icon-button>
                <icon-button
                    slot="more-buttons"
                    @click.stop.prevent="averagePoint()"
                    href="/average.svg"
                    label-id="location.edit.average"
                ></icon-button>
                <icon-button
                    slot="more-buttons"
                    @click.stop.prevent="deletePoint()"
                    href="/delete.svg"
                    label-id="location.edit.delete"
                ></icon-button>
            </default-layout>
            <show-modal *if="gettingLocation">
                <div class="getting-location">
                    <i18n-label
                        id="location.add.gettingCurrentLocation"
                    ></i18n-label>
                </div>
            </show-modal>
            <show-modal *if="showQr" @clickoutside="closeQrCode()">
                <location-share
                    lat="{{lat}}"
                    lon="{{lon}}"
                    name="{{point.name}}"
                    @close="closeQrCode()"
                ></location-share>
            </show-modal>
        </location-wrapper>
    `,
}, LocationEditComponent);
