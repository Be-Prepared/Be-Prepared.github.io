import { AvailabilityState } from '../datatypes/availability-state';
import { Component, css, html } from 'fudgel';
import { di } from '../di';
import {
    DistanceService,
    DISTANCE_SYSTEMS,
    DistanceSystemDefault,
} from '../services/distance.service';
import { DistanceSystem } from '../datatypes/distance-system';
import {
    GeolocationCoordinateResultSuccess,
    GeolocationService,
} from '../services/geolocation.service';
import { of, Subject } from 'rxjs';
import { PermissionsService } from '../services/permissions.service';
import { switchMap, takeUntil } from 'rxjs/operators';

@Component('speed-app', {
    style: css`
        :host {
            font-size: 1.2em;
        }

        .wrapper {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            height: 100%;
            width: 100%;
            overflow: hidden;
            text-align: center;
        }

        @media (orientation: landscape) {
            .wrapper {
                flex-direction: row;
            }
        }

        .speed-display {
            flex: 2;
            min-height: 0;
            min-width: 0;
        }

        .speed-info {
            flex: 1;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 0;
            min-width: 0;
            gap: 0.3em;
        }

        .info-item {
            display: flex;
            flex-direction: row;
            gap: 0.4em;
            align-items: baseline;
        }

        @media (orientation: landscape) {
            .speed-info {
                gap: 0.6em;
            }

            .info-item {
                flex-direction: column;
                gap: 0;
                align-items: center;
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
        <permission-error *if="explainError"></permission-error>
        <default-layout *if="showControls">
            <div class="wrapper">
                <div class="speed-display">
                    <grow-to-fit-font-size>{{currentSpeed}}</grow-to-fit-font-size>
                </div>
                <div class="speed-info">
                    <div class="info-item">
                        <span><i18n-label id="speed.average"></i18n-label></span>
                        <span>{{averageSpeed}}</span>
                    </div>
                    <div class="info-item">
                        <span><i18n-label id="speed.maximum"></i18n-label></span>
                        <span>{{maximumSpeed}}</span>
                    </div>
                    <pretty-select
                        i18n-base="info.distances"
                        value="{{distanceSystem}}"
                        .options="distanceSystems"
                        @change="changeDistanceSystem($event.detail)"
                    ></pretty-select>
                </div>
            </div>
        </default-layout>
    `,
})
export class SpeedAppComponent {
    private _distanceService = di(DistanceService);
    private _geolocationService = di(GeolocationService);
    private _lastPosition: GeolocationCoordinateResultSuccess | null = null;
    private _permissionsService = di(PermissionsService);
    private _subject = new Subject();
    averageSpeed = '';
    currentSpeed = '';
    distanceSystem: DistanceSystem = DistanceSystemDefault;
    distanceSystems = DISTANCE_SYSTEMS;
    explainAsk = false;
    explainDeny = false;
    explainError = false;
    explainUnavailable = false;
    maximumSpeed = '';
    showControls = false;

    onInit() {
        this._distanceService
            .getCurrentSetting()
            .pipe(takeUntil(this._subject))
            .subscribe((system) => {
                this.distanceSystem = system;
                this._updateDisplay();
            });

        this._geolocationService
            .availabilityState()
            .pipe(
                takeUntil(this._subject),
                switchMap((value) => {
                    this.explainAsk = value === AvailabilityState.PROMPT;
                    this.explainDeny = value === AvailabilityState.DENIED;
                    this.explainUnavailable =
                        value === AvailabilityState.UNAVAILABLE;
                    this.explainError = value === AvailabilityState.ERROR;
                    this.showControls = value === AvailabilityState.ALLOWED;

                    if (this.showControls) {
                        return this._geolocationService.getPositionSuccess();
                    }

                    return of(null);
                })
            )
            .subscribe((position) => {
                if (position) {
                    this._lastPosition = position;
                    this._updateDisplay();
                }
            });
    }

    onDestroy() {
        this._subject.next(null);
        this._subject.complete();
    }

    changeDistanceSystem(value: DistanceSystem) {
        this._distanceService.setDistanceSystem(value);
    }

    grant() {
        this.explainAsk = false;
        this._permissionsService.geolocation(true);
    }

    private _speedNumber(metersPerSecond: number): string {
        if (this.distanceSystem === DistanceSystem.IMPERIAL) {
            const mph = (metersPerSecond * 3.2808398950131 * 3600) / 5280;

            return Math.round(mph).toString();
        }

        return Math.round(metersPerSecond * 3.6).toString();
    }

    private _updateDisplay() {
        if (!this._lastPosition) {
            return;
        }

        this.currentSpeed = this._speedNumber(this._lastPosition.speed);
        this.averageSpeed = this._distanceService.metersToString(
            this._lastPosition.speedSmoothed,
            { isSpeed: true }
        );
        this.maximumSpeed = this._distanceService.metersToString(
            this._lastPosition.speedMax,
            { isSpeed: true }
        );
    }
}
