import { AvailabilityState } from '../datatypes/availability-state';
import { Component, css, di, html } from 'fudgel';
import {
    GeolocationCoordinateResult,
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
    direction: string | null;
}

@Component('location-app', {
    style: css`
        .full {
            height: 100%;
            width: 100%;
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
        <div *if="showControls" class="full">
            <location-current> *if="control === 'current'"></location-current>
        </div>
    `,
})
export class LocationAppComponent {
    #geolocationService = di(GeolocationService);
    #permissionsService = di(PermissionsService);
    #subject = new Subject();
    #wakeLockService = di(WakeLockService);
    control = 'current';
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

    #getCurrentStatus() {
        this.#wakeLockService.request();

        // Add a subscriber to keep the service active no matter what route is
        // being shown.
        this.#geolocationService
            .getPosition()
            .pipe(takeUntil(this.#subject))
            .subscribe(() => {});
    }
}
