import { AvailabilityState } from '../datatypes/availability-state';
import { Component, css, di, html } from 'fudgel';
import {
    GeolocationCoordinateResult,
    GeolocationCoordinateResultSuccess,
    GeolocationService,
} from '../services/geolocation.service';
import { PermissionsService } from '../services/permissions.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { WakeLockService } from '../services/wake-lock.service';

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
            <div *if="coords && coords.timestamp" class="content">
                <grow-to-fit>
                    <div>Latitude: {{ lat }}</div>
                    <div>Longitude: {{ lon }}</div>
                    <div>Accuracy: {{ acc }}m</div>
                    <div>Speed: {{ speed }}m/s</div>
                    <div>
                        Heading:
                        <span *if="heading !== null">{{ heading }}°</span>
                    </div>
                    <div *if="alt">Altitude: {{ alt }}m</div>
                    <div *if="altAcc">Altitude Accuracy: {{ altAcc }}m</div>
                </grow-to-fit>
            </div>
            <div *if="coords && coords.error" class="content">
                <p>There is an error retrieving the location.</p>
                <p *if="coords.error.code === coords.error.PERMISSION_DENIED">
                    Permission denied.
                </p>
                <p
                    *if="coords.error.code === coords.error.POSITION_UNAVAILABLE"
                >
                    Position unavailable.
                </p>
            </div>
            <div *if="!coords" class="content">
                <p>Retrieving location...</p>
            </div>
            <div class="buttons">
                <back-button></back-button>
            </div>
        </div>
    `,
})
export class LocationAppComponent {
    #geolocationService = di(GeolocationService);
    #permissionsService = di(PermissionsService);
    #subject = new Subject();
    #wakeLockService = di(WakeLockService);
    coords: GeolocationCoordinateResult | null = null;
    explainAsk = false;
    explainDeny = false;
    explainUnavailable = false;
    showControls = false;
    lat: number | null = null;
    lon: number | null = null;
    acc: number | null = null;
    alt: number | null = null;
    altAcc: number | null = null;
    speed: number | null = null;
    heading: number | null = null;

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

    #getCurrentStatus() {
        this.#wakeLockService.request();
        this.#geolocationService
            .getPosition()
            .pipe(takeUntil(this.#subject))
            .subscribe((position) => {
                this.coords = position;

                if (position.timestamp) {
                    const positionTyped =
                        position as GeolocationCoordinateResultSuccess;
                    this.lat = positionTyped.latitude;
                    this.lon = positionTyped.longitude;
                    this.acc = positionTyped.accuracy;
                    this.alt = positionTyped.altitude;
                    this.altAcc = positionTyped.altitudeAccuracy;
                    this.speed = positionTyped.speed;

                    if (!isNaN(positionTyped.heading)) {
                        this.heading = positionTyped.heading;
                    } else {
                        this.heading = null;
                    }
                }
            });
    }
}
