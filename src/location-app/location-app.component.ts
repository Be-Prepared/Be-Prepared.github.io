import { AvailabilityState } from '../datatypes/availability-state';
import { Component, css, di, html } from 'fudgel';
import { GeolocationService } from '../services/geolocation.service';
import { PermissionsService } from '../services/permissions.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

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
            <location-current
                *if="control === 'current'"
                @list.stop.prevent="setControl('waypoints')"
            ></location-current>
            <location-waypoints
                *if="control === 'waypoints'"
                @current.stop.prevent="setControl('current')"
                @add.stop.prevent="setControl('add-edit')"
                @edit.stop.prevent="setControl('add-edit', $event.detail)"
            ></location-waypoints>
            <location-add-edit
                *if="control === 'add-edit'"
                id="{{waypointId}}"
            ></location-add-edit>
        </div>
    `,
})
export class LocationAppComponent {
    #geolocationService = di(GeolocationService);
    #permissionsService = di(PermissionsService);
    #subject = new Subject();
    control = 'current';
    explainAsk = false;
    explainDeny = false;
    explainUnavailable = false;
    showControls = false;
    waypointId?: number;

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
                }
            });
    }

    onDestroy() {
        this.#subject.next(null);
        this.#subject.complete();
    }

    grant() {
        this.#permissionsService.geolocation(true);
    }

    setControl(control: string, waypointId?: number) {
        this.control = control;
        this.waypointId = waypointId;
    }

    #getCurrentStatus() {
        // Add a subscriber to keep the service active no matter what route is
        // being shown.
        this.#geolocationService
            .getPosition()
            .pipe(takeUntil(this.#subject))
            .subscribe(() => {});
    }
}
