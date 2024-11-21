import { AvailabilityState } from '../datatypes/availability-state';
import { Component, css, html } from 'fudgel';
import { CoordinateService } from '../services/coordinate.service';
import { di } from '../di';
import { GeolocationService } from '../services/geolocation.service';
import { finalize, first, takeUntil } from 'rxjs/operators';
import { I18nService } from '../i18n/i18n.service';
import { LatLon } from '../datatypes/lat-lon';
import { PreferenceService } from '../services/preference.service';
import { Subject } from 'rxjs';
import { ToastService } from '../services/toast.service';

@Component('sun-moon-app', {
    style: css`
        .flex-full {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
        }

        .location {
            display: flex;
            align-items: center;
            gap: 1em;
        }

        .date {
            padding-top: 0.25em;
            display: flex;
            flex-direction: column;
        }

        .coordinates {
            display: flex;
            flex-direction: column;
        }

        .grow {
            flex-grow: 1;
        }

        .wrapper {
            padding-top: 1em;
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

        load-svg {
            width: 3em;
            height: 3em;
        }

        .space-between-bottom {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
        }

        .getting-location {
            display: flex;
            padding: 0.5em;
            border: 1px solid var(--fg-color);
        }
    `,
    template: html`
        <default-layout frameless>
            <div class="flex-full">
                <div class="location">
                    <div class="grow coordinates">
                        <div class="space-between-bottom">
                            <i18n-label
                                id="sunMoon.enterCoordinates"
                            ></i18n-label>
                            <location-coordinate-info></location-coordinate-info>
                        </div>
                        <pretty-input
                            type="text"
                            @change.stop.prevent="locationUpdate($event.detail)"
                            #ref="input"
                            class="grow"
                            help-html="location.help.html"
                        ></pretty-input>
                    </div>
                    <div *if="allowGetLocation">
                        <load-svg
                            href="/location.svg"
                            @click.stop.prevent="getCurrentLocation()"
                        ></load-svg>
                    </div>
                </div>
                <div class="date">
                    <div class="space-between-bottom">
                        <i18n-label id="sunMoon.enterDate"></i18n-label>
                        <location-coordinate-info></location-coordinate-info>
                    </div>
                    <pretty-input
                        type="datetime-local"
                        @change.stop.prevent="dateUpdate($event.detail)"
                        #ref="date"
                        class="grow"
                    ></pretty-input>
                </div>
                <div class="wrapper">
                    <div class="wrapper-inner">
                        <div>{{location}}</div>
                        <nearest-major-city
                            .coordinates="coordinates"
                        ></nearest-major-city>
                        <div class="gap"></div>
                        <sun-position
                            .coordinates="coordinates"
                            .date="dateValue"
                        ></sun-position>
                        <sun-times
                            .coordinates="coordinates"
                            .date="dateValue"
                        ></sun-times>
                        <div class="gap"></div>
                        <moon-position
                            .coordinates="coordinates"
                            .date="dateValue"
                        ></moon-position>
                        <moon-times
                            .coordinates="coordinates"
                            .date="dateValue"
                        ></moon-times>
                        <moon-illumination
                            .coordinates="coordinates"
                            .date="dateValue"
                        ></moon-illumination>
                    </div>
                </div>
            </div>
        </default-layout>
        <show-modal *if="gettingLocation">
            <div class="getting-location">
                <i18n-label id="sunMoon.geolocation"></i18n-label>
            </div>
        </show-modal>
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
    date?: HTMLInputElement;
    dateValue = new Date();
    gettingLocation = false;
    input?: HTMLInputElement;
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

        if (this.date) {
            this.date.value = this.dateValue.toISOString().slice(0, 16);
        }

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

    dateUpdate(value: string) {
        this.dateValue = new Date(value);
    }

    locationUpdate(value: string) {
        this._coordinateService.fromString(value).subscribe((coordinates) => {
            if (coordinates) {
                this._preferenceService.sunMoonLocation.setItem(value);
                this.coordinates = coordinates;
                this._coordinatesUpdated();
            }
        });
    }

    getCurrentLocation() {
        this.gettingLocation = true;
        this._geolocationService
            .getPosition()
            .pipe(
                takeUntil(this.subject),
                first(),
                finalize(() => {
                    this.gettingLocation = false;
                })
            )
            .subscribe(
                (geolocation) => {
                    if (geolocation.success) {
                        this._setValue(`${geolocation.lat} ${geolocation.lon}`);
                    } else {
                        this._geolocationError();
                    }
                },
                () => {
                    this._geolocationError();
                }
            );
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
