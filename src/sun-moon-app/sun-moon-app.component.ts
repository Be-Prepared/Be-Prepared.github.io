import { AvailabilityState } from '../datatypes/availability-state';
import { Component, css, di, html } from 'fudgel';
import { CoordinateService, LatLon } from '../services/coordinate.service';
import { GeolocationService } from '../services/geolocation.service';
import { first, takeUntil, tap } from 'rxjs/operators';
import { I18nService } from '../i18n/i18n.service';
import { PreferenceService } from '../services/preference.service';
import { Subject } from 'rxjs';
import { ToastService } from '../services/toast.service';

@Component('sun-moon-app', {
    style: css`
        :host {
            display: flex;
            flex-direction: column;
            font-size: 1.2em;
            height: 100%;
            width: 100%;
            box-sizing: border-box;
        }

        .content {
            height: 100%;
            width: 100%;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .location {
            padding: 1em 1em 0 1em;
            display: flex;
            align-items: center;
            gap: 1em;
        }

        .coordinates {
            display: flex;
            flex-direction: column;
        }

        .grow {
            flex-grow: 1;
        }

        .wrapper {
            padding: 1em;
            height: 100%;
            width: 100%;
            overflow: hidden;
            display: flex;
            box-sizing: border-box;
        }

        .wrapper-inner {
            flex-grow: 1;
            padding: 0.3em;
            border-style: solid;
            box-sizing: border-box;
            border-width: 1px;
            overflow-x: auto;
            height: 100%;
            width: 100%;
        }

        .gap {
            height: 0.5em;
        }

        .buttons {
            display: flex;
        }

        @media (orientation: landscape) {
            :host {
                flex-direction: row-reverse;
            }

            .buttons {
                flex-direction: column-reverse;
            }
        }

        load-svg {
            width: 3em;
            height: 3em;
        }

        .space-between-bottom {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
        }
    `,
    template: html`
        <div class="content">
            <div class="location">
                <div class="grow coordinates">
                    <div class="space-between-bottom">
                        <i18n-label id="sunMoon.enterCoordinates"></i18n-label>
                        <location-coordinate-info></location-coordinate-info>
                    </div>
                    <pretty-input
                        type="text"
                        @change.stop.prevent="locationUpdate($event.detail)"
                        #ref="input"
                        class="grow"
                    ></pretty-input>
                </div>
                <div *if="allowGetLocation">
                    <load-svg
                        href="/location.svg"
                        @click.stop.prevent="getCurrentLocation()"
                    ></load-svg>
                </div>
            </div>
            <div class="wrapper">
                <div class="wrapper-inner">
                    <div>{{location}}</div>
                    <nearest-major-city
                        .coordinates="coordinates"
                    ></nearest-major-city>
                    <div class="gap"></div>
                    <sun-position .coordinates="coordinates"></sun-position>
                    <sun-times .coordinates="coordinates"></sun-times>
                    <div class="gap"></div>
                    <moon-position .coordinates="coordinates"></moon-position>
                    <moon-times .coordinates="coordinates"></moon-times>
                    <moon-illumination
                        .coordinates="coordinates"
                    ></moon-illumination>
                </div>
            </div>
        </div>
        <div class="buttons">
            <back-button class="paddingTop"></back-button>
        </div>
    `,
})
export class SunMoonAppComponent {
    private _coordinateService = di(CoordinateService);
    private _geolocationService = di(GeolocationService);
    private _i18nService = di(I18nService);
    private _preferenceService = di(PreferenceService);
    private _toastService = di(ToastService);
    allowGetLocation = false;
    coordinates: LatLon | null = null;
    gettingLocation = false;
    input: any;
    location: string = '';
    subject = new Subject();

    constructor() {
        this._geolocationService
            .availabilityState()
            .pipe(takeUntil(this.subject))
            .subscribe((state) => {
                if (
                    state === AvailabilityState.PROMPT ||
                    state === AvailabilityState.ALLOWED
                ) {
                    this.allowGetLocation = true;
                } else {
                    this.allowGetLocation = false;
                }
            });
    }

    onViewInit() {
        const locationStr = this._preferenceService.sunMoonLocation.getItem();

        if (locationStr) {
            this._setValue(locationStr);
        } else {
            this._coordinatesUpdated();
        }
    }

    onDestroy() {
        this.subject.next(null);
        this.subject.complete();
    }

    locationUpdate(value: string) {
        const coordinates = this._coordinateService.fromString(value);

        if (coordinates) {
            this._preferenceService.sunMoonLocation.setItem(value);
            this.coordinates = coordinates;
            this._coordinatesUpdated();
        }
    }

    getCurrentLocation() {
        this.gettingLocation = true;
        this._geolocationService
            .getPosition()
            .pipe(
                takeUntil(this.subject),
                first(),
                tap(() => {
                    this.gettingLocation = false;
                })
            )
            .subscribe((geolocation) => {
                if (geolocation.success) {
                    this._setValue(`${geolocation.latitude} ${geolocation.longitude}`);
                } else {
                    this._geolocationError();
                }
            }, () => {
                this._geolocationError();
            });
    }

    _coordinatesUpdated() {
        if (this.coordinates) {
            this.location = this._coordinateService.latLonToSystemString(
                this.coordinates.lat,
                this.coordinates.lon
            );
        } else {
            this.location = this._i18nService.get('sunMoon.locationUnknown');
        }
    }

    _geolocationError() {
        this._toastService.popI18n('sunMoon.geolocationError');
    }

    _setValue(value: string) {
        if (this.input) {
            this.input.value = value;
        }

        this.locationUpdate(value);
    }
}
