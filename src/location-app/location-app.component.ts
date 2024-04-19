import { AvailabilityState } from '../datatypes/availability-state';
import { BearingService } from '../services/bearing.service';
import { Component, css, di, html } from 'fudgel';
import { CoordinateService } from '../services/coordinate.service';
import { DistanceService } from '../services/distance.service';
import {
    GeolocationCoordinateResult,
    GeolocationCoordinateResultSuccess,
    GeolocationService,
} from '../services/geolocation.service';
import { PermissionsService } from '../services/permissions.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { WakeLockService } from '../services/wake-lock.service';

interface DataToDisplay {
    lat: string | null;
    lon: string | null;
    mgrs: string | null;
    utmups: string | null;
    acc: string;
    alt: string | null;
    altAcc: string | null;
    speed: string;
    heading: number | null;
    bearing: string | null;
}

@Component('location-app', {
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
        }

        @media (orientation: landscape) {
            .wrapper {
                flex-direction: row-reverse;
            }

            .buttons {
                flex-direction: column-reverse;
            }
        }
    `,
    template: html`
        <permission-prompt
            *if="explainAsk"
            @grant.stop.prevent="grant()"
            message-id="location.explainAsk"
        ></permission-prompt>
        <permission-denied *if="explainDeny"></permission-denied>
        <location-unavailable *if="explainUnavailable"></location-unavailable>
        <div *if="showControls" class="wrapper">
            <div *if="dataToDisplay" class="content">
                <grow-to-fit>
                    <div
                        *if="dataToDisplay.lat"
                        @click="toggleCoordinateSystem()"
                    >
                        <i18n-label id="location.lat" ws=""></i18n-label
                        >&nbsp;{{ dataToDisplay.lat }}
                    </div>
                    <div
                        *if="dataToDisplay.lon"
                        @click="toggleCoordinateSystem()"
                    >
                        <i18n-label id="location.lon" ws=""></i18n-label
                        >&nbsp;{{ dataToDisplay.lon }}
                    </div>
                    <div
                        *if="dataToDisplay.mgrs"
                        @click="toggleCoordinateSystem()"
                    >
                        <div>
                            <i18n-label id="location.mgrs" ws=""></i18n-label>
                        </div>
                        <div>{{ dataToDisplay.mgrs }}</div>
                    </div>
                    <div
                        *if="dataToDisplay.utmups"
                        @click="toggleCoordinateSystem()"
                    >
                        <div>
                            <i18n-label id="location.utmups" ws=""></i18n-label>
                        </div>
                        <div>{{ dataToDisplay.utmups }}</div>
                    </div>
                    <div @click="toggleDistanceSystem()">
                        <i18n-label id="location.accuracy" ws=""></i18n-label
                        >&nbsp;{{ dataToDisplay.acc }}
                    </div>
                    <div @click="toggleDistanceSystem()">
                        <i18n-label id="location.speed" ws=""></i18n-label
                        >&nbsp;{{ dataToDisplay.speed }}/s
                    </div>
                    <div>
                        <i18n-label id="location.heading" ws=""></i18n-label
                        >&nbsp;<span *if="dataToDisplay.heading !== null"
                            >{{ dataToDisplay.heading }}°&nbsp;{{ bearing
                            }}</span
                        ><span *if="dataToDisplay.heading === null"
                            ><i18n-label
                                id="location.headingNowhere"
                            ></i18n-label
                        ></span>
                    </div>
                    <div *if="alt" @click="toggleDistanceSystem()">
                        <i18n-label id="location.altitude" ws=""></i18n-label
                        >&nbsp;{{ dataToDisplay.alt }}
                    </div>
                    <div *if="altAcc" @click="toggleDistanceSystem()">
                        <i18n-label
                            id="location.altitudeAccuracy"
                            ws=""
                        ></i18n-label
                        >&nbsp;{{ dataToDisplay.altAcc }}m
                    </div>
                </grow-to-fit>
            </div>
            <div *if="position && position.error" class="content">
                <p>There is an error retrieving the location.</p>
                <p
                    *if="position.error.code === position.error.PERMISSION_DENIED"
                >
                    Permission denied.
                </p>
                <p
                    *if="position.error.code === position.error.POSITION_UNAVAILABLE"
                >
                    Position unavailable.
                </p>
            </div>
            <div *if="!position" class="content">
                <p>Retrieving location...</p>
            </div>
            <div class="buttons">
                <back-button></back-button>
            </div>
        </div>
    `,
})
export class LocationAppComponent {
    #bearingService = di(BearingService);
    #coordinateService = di(CoordinateService);
    #distanceService = di(DistanceService);
    #geolocationService = di(GeolocationService);
    #permissionsService = di(PermissionsService);
    #subject = new Subject();
    #wakeLockService = di(WakeLockService);
    dataToDisplay: DataToDisplay | null = null;
    explainAsk = false;
    explainDeny = false;
    explainUnavailable = false;
    position: GeolocationCoordinateResult | null = null;
    showControls = false;

    onInit() {
        this.#geolocationService
            .availabilityState()
            .pipe(takeUntil(this.#subject))
            .subscribe((value) => {
                this.explainAsk = value === AvailabilityState.PROMPT;
                this.explainDeny = value === AvailabilityState.DENIED;
                this.explainUnavailable =
                    value === AvailabilityState.UNAVAILABLE;
                this.showControls = value === AvailabilityState.ALLOWED;

                if (this.showControls) {
                    this.#getCurrentStatus();
                } else {
                    this.#wakeLockService.release();
                }
            });
    }

    onDestroy() {
        this.#subject.next(null);
        this.#subject.complete();
        this.#wakeLockService.release();
    }

    grant() {
        this.#permissionsService.geolocation(true);
    }

    toggleCoordinateSystem() {
        this.#coordinateService.toggleSystem();
        this.#redraw();
    }

    toggleDistanceSystem() {
        this.#distanceService.toggleDistanceSystem();
        this.#redraw();
    }

    #getCurrentStatus() {
        this.#wakeLockService.request();
        this.#geolocationService
            .getPosition()
            .pipe(takeUntil(this.#subject))
            .subscribe((position) => {
                this.position = position;
                this.#redraw();
            });
    }

    #redraw() {
        if (this.position && this.position.timestamp) {
            this.#updateDisplayedValues(
                this.position as GeolocationCoordinateResultSuccess
            );
        } else {
            this.dataToDisplay = null;
        }
    }

    #updateDisplayedValues(position: GeolocationCoordinateResultSuccess) {
        const system = this.#coordinateService.latLonToSystem(
            position.latitude,
            position.longitude
        );
        const acc = this.#distanceService.metersToString(position.accuracy);
        const alt = position.altitude
            ? this.#distanceService.metersToString(position.altitude)
            : null;
        const altAcc = position.altitudeAccuracy
            ? this.#distanceService.metersToString(position.altitudeAccuracy)
            : null;
        const speed = this.#distanceService.metersToString(position.speed);
        let heading = null;
        let bearing = null;

        // Preserve the last heading
        if (!isNaN(position.heading)) {
            heading = Math.round(position.heading);
            bearing = this.#bearingService.toCompassPoint(heading);
        }

        // Tie to a single property for faster updates
        this.dataToDisplay = {
            lat: 'lat' in system ? system.lat : null,
            lon: 'lon' in system ? system.lon : null,
            mgrs: 'mgrs' in system ? system.mgrs : null,
            utmups: 'utmups' in system ? system.utmups : null,
            acc,
            alt,
            altAcc,
            speed,
            heading,
            bearing,
        };
    }
}
