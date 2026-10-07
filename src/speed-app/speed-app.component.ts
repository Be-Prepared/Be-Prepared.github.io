import { AccessState } from '../services/access/access-controller';
import { component, css, html } from 'fudgel';
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
import { filter, switchMap, takeUntil } from 'rxjs/operators';

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

        // Wait for permission so the GPS only starts (and the browser only
        // prompts) after the "Allow" button in location-wrapper.
        this._geolocationService
            .availabilityState()
            .pipe(
                filter((state) => state === AccessState.READY),
                switchMap(() => this._geolocationService.getPositionSuccess()),
                // Last, so the inner position watch is stopped too.
                takeUntil(this._subject)
            )
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

component('speed-app', {
    style: css`
        .wrapper {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: var(--space-3);
            height: 100%;
            width: 100%;
            box-sizing: border-box;
            padding: var(--space-4);
            overflow: hidden;
            text-align: center;
            /* Location screens scale their text up; set a known size. */
            font-size: 1rem;
        }

        @media (orientation: landscape) {
            .wrapper {
                flex-direction: row;
                align-items: center;
            }
        }

        .speed-display {
            flex: 2;
            min-height: 0;
            min-width: 0;
            font-variant-numeric: tabular-nums;
        }

        .speed-info {
            flex-shrink: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: var(--space-3);
        }

        .stats {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: var(--space-3);
            width: min(100%, 26rem);
        }

        @media (orientation: landscape) {
            .stats {
                grid-template-columns: 1fr;
                width: 12rem;
            }
        }

        .stat {
            display: flex;
            flex-direction: column;
            gap: 0.15rem;
            padding: var(--space-3);
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-l);
        }

        .label {
            font-size: 0.85rem;
            color: var(--fg-muted);
        }

        .value {
            font-size: 1.5rem;
            font-weight: 700;
            font-variant-numeric: tabular-nums;
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
                        <div class="stats">
                            <div class="stat">
                                <span class="label"
                                    ><i18n-label
                                        id="speed.average"
                                        ws=""
                                    ></i18n-label
                                ></span>
                                <span class="value">{{averageSpeed}}</span>
                            </div>
                            <div class="stat">
                                <span class="label"
                                    ><i18n-label
                                        id="speed.maximum"
                                        ws=""
                                    ></i18n-label
                                ></span>
                                <span class="value">{{maximumSpeed}}</span>
                            </div>
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
}, SpeedAppComponent);
