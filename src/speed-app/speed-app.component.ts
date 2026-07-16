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
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component('speed-app', {
    style: css`
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
        <location-wrapper>
            <default-layout>
                <div class="wrapper">
                    <div class="speed-display">
                        <grow-to-fit-font-size
                            >{{currentSpeed}}</grow-to-fit-font-size
                        >
                    </div>
                    <div class="speed-info">
                        <div class="info-item">
                            <span
                                ><i18n-label id="speed.average"></i18n-label
                            ></span>
                            <span>{{averageSpeed}}</span>
                        </div>
                        <div class="info-item">
                            <span
                                ><i18n-label id="speed.maximum"></i18n-label
                            ></span>
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
        </location-wrapper>
    `,
})
export class SpeedAppComponent {
    private _distanceService = di(DistanceService);
    private _geolocationService = di(GeolocationService);
    private _lastPosition: GeolocationCoordinateResultSuccess | null = null;
    private _subject = new Subject();
    averageSpeed = '';
    currentSpeed = '';
    distanceSystem: DistanceSystem = DistanceSystemDefault;
    distanceSystems = DISTANCE_SYSTEMS;
    maximumSpeed = '';

    onInit() {
        this._distanceService
            .getCurrentSetting()
            .pipe(takeUntil(this._subject))
            .subscribe((system) => {
                this.distanceSystem = system;
                this._updateDisplay();
            });

        this._geolocationService
            .getPositionSuccess()
            .pipe(takeUntil(this._subject))
            .subscribe((position) => {
                this._lastPosition = position;
                this._updateDisplay();
            });
    }

    onDestroy() {
        this._subject.next(null);
        this._subject.complete();
    }

    changeDistanceSystem(value: DistanceSystem) {
        this._distanceService.setDistanceSystem(value);
    }

    private _updateDisplay() {
        if (!this._lastPosition) {
            return;
        }

        this.currentSpeed = this._distanceService.metersToString(
            this._lastPosition.speed,
            { floor: true, isSpeed: true, omitLabel: true, wholeNumber: true }
        );
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
