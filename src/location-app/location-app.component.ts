import { AvailabilityState } from '../datatypes/availability-state';
import { Component, css, di, html } from 'fudgel';
import { filter, switchMap } from 'rxjs/operators';
import {
    GeolocationCoordinateResult,
    GeolocationService,
} from '../services/geolocation.service';
import { LatLon } from '../datatypes/lat-lon';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component('location-app', {
    style: css`
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
        }

        .gap-above {
            padding-top: 0.4em;
        }

        .multi-line {
            display: flex;
            flex-direction: column;
            text-align: center;
        }

        .full-width {
            width: 100%;
        }
    `,
    template: html`
        <location-wrapper>
            <default-layout>
                <div *if="latLon" class="content">
                    <location-coordinates
                        .coords="latLon"
                    ></location-coordinates>
                    <div class="gap-above full-width">
                        <location-field
                            id="current.1"
                            default="ACCURACY"
                        ></location-field>
                    </div>
                    <div class="full-width">
                        <location-field
                            id="current.2"
                            default="SPEED"
                        ></location-field>
                    </div>
                    <div class="full-width">
                        <location-field
                            id="current.3"
                            default="HEADING"
                        ></location-field>
                    </div>
                    <div class="full-width">
                        <location-field
                            id="current.4"
                            default="ALTITUDE"
                        ></location-field>
                    </div>
                    <div class="full-width">
                        <location-field
                            id="current.5"
                            default="ALTITUDE_ACCURACY"
                        ></location-field>
                    </div>
                </div>
                <div *if="position && position.error" class="content">
                    <p>
                        <i18n-label id="location.positionError"></i18n-label>
                    </p>
                    <p
                        *if="position.error.code === position.error.PERMISSION_DENIED"
                    >
                        <i18n-label id="location.positionDenied"></i18n-label>
                    </p>
                    <p
                        *if="position.error.code === position.error.POSITION_UNAVAILABLE"
                    >
                        <i18n-label
                            id="location.positionUnavailable"
                        ></i18n-label>
                    </p>
                </div>
                <div *if="!position" class="content">
                    <p>
                        <i18n-label
                            id="location.retrievingLocation"
                        ></i18n-label>
                    </p>
                </div>
                <scaling-icon
                    slot="more-buttons"
                    @click="goToList()"
                    href="/list.svg"
                ></scaling-icon>
            </default-layout>
        </location-wrapper>
    `,
})
export class LocationAppComponent {
    private _geolocationService = di(GeolocationService);
    private _subject = new Subject();
    latLon: LatLon | null = null;
    position: GeolocationCoordinateResult | null = null;

    onInit() {
        this._geolocationService
            .availabilityState()
            .pipe(
                takeUntil(this._subject),
                filter((state) => {
                    return state === AvailabilityState.ALLOWED;
                }),
                switchMap(() => {
                    return this._geolocationService.getPosition();
                })
            )
            .subscribe((position) => {
                this.position = position;
                this._redraw();
            });
    }

    onDestroy() {
        this._subject.next(null);
        this._subject.complete();
    }

    goToList() {
        history.pushState({}, document.title, '/location-list');
    }

    private _redraw() {
        if (this.position && this.position.success) {
            this.latLon = {
                lat: this.position.lat,
                lon: this.position.lon,
            };
        } else {
            this.latLon = null;
        }
    }
}
