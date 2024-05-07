import { Component, css, di, html } from 'fudgel';
import { CoordinateService, LatLon } from '../services/coordinate.service';
// import { first } from 'rxjs/operators';
// import { GeolocationService } from '../services/geolocation.service';
import { I18nService } from '../i18n/i18n.service';
import { default as SunCalc } from 'suncalc';

@Component('sun-moon-app', {
    style: css`
        :host {
            display: flex;
            flex-direction: column;
            font-size: 1.2em;
            height: 100%;
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
        }

        .wide {
            width: 100%;
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
    `,
    template: html`
        <div class="content">
            <div class="location">
                <div><i18n-label id="sunMoon.enterCoordinates"></i18n-label></div>
                <input
                    type="text"
                    @change="locationUpdate($event.target.value)"
                    #ref="input"
                    class="wide"
                />
            </div>
            <div class="wrapper">
                <div class="wrapper-inner">
                    <div>{{location}}</div>
                    <nearest-major-city .coordinates="coordinates"></nearest-major-city>
                    <div class="gap"></div>
                    <sun-position .coordinates="coordinates"></sun-position>
                    <sun-times .coordinates="coordinates"></sun-times>
                    <div class="gap"></div>
                    <moon-position .coordinates="coordinates"></moon-position>
                    <moon-times .coordinates="coordinates"></moon-times>
                    <moon-illumination .coordinates="coordinates"></moon-illumination>
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
    // private _geolocationService = di(GeolocationService);
    private _i18nService = di(I18nService);
    coordinates: LatLon | null = null;
    input?: HTMLInputElement;
    location: string = '';
    moonIllumination: SunCalc.GetMoonIlluminationResult | null = null;
    moonPosition: SunCalc.GetMoonPositionResult | null = null;
    moonTimes: SunCalc.GetMoonTimes | null = null;
    nearestMajorCity: string | null = null;
    sunPosition: SunCalc.GetSunPositionResult | null = null;
    sunTimes: SunCalc.GetTimesResult | null = null;

    constructor() {
        // FIXME - if granted, pull current location
        // this._geolocationService
        //     .getPosition()
        //     .pipe(first())
        //     .subscribe((geolocation) => {
        //         console.log(geolocation);
        //     });
        const locationStr = localStorage.getItem('sunMoonLocation');

        if (locationStr) {
            this.locationUpdate(locationStr);
        } else {
            this._coordinatesUpdated();
        }
    }

    locationUpdate(value: string) {
        const coordinates = this._coordinateService.fromString(value);

        if (coordinates) {
            localStorage.setItem('sunMoonLocation', value);
            this.coordinates = coordinates;
            this._coordinatesUpdated();
        }
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
}
