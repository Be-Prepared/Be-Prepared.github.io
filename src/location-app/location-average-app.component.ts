import { AccessState } from '../services/access/access-controller';
import { AverageSample, averageSamples } from './location-average-math';
import { component, css, html } from 'fudgel';
import { CoordinateService } from '../services/coordinate.service';
import { di } from '../di';
import { DistanceService } from '../services/distance.service';
import { filter, switchMap, takeUntil } from 'rxjs/operators';
import {
    GeolocationCoordinateResult,
    GeolocationService,
} from '../services/geolocation.service';
import { LatLon } from '../datatypes/lat-lon';
import { Subject } from 'rxjs';
import { WakeLockService } from '../services/wake-lock.service';
import { WaypointSaved } from '../datatypes/waypoint-saved';
import { WaypointService } from './waypoint.service';
import { XYZ } from '../datatypes/xyz';

interface DataPoint extends XYZ, LatLon, AverageSample {}

export class LocationAverageComponent {
    private _coordinateService = di(CoordinateService);
    private _distanceService = di(DistanceService);
    private _geolocationService = di(GeolocationService);
    private _geolocationStopSubject = new Subject();
    private _wakeLockService = di(WakeLockService);
    private _waypointService = di(WaypointService);
    averagedDataPoint: DataPoint | null = null;
    dataPoints: DataPoint[] = [];
    debug = '';
    id?: string;
    ninetyFive = ''; // 95% radius around the average
    point: WaypointSaved | null = null;
    pointCount = 0;
    ignoredCount = 0;
    xDelta = '';
    yDelta = '';

    onInit() {
        const id = this.id;
        let point;

        if (id) {
            point = this._waypointService.getPoint(+id);
        }

        if (!point) {
            history.go(-1);
            return;
        }

        this.point = point;
        this._wakeLockService.request();
        this._geolocationService
            .availabilityState()
            .pipe(
                filter((state) => {
                    return state === AccessState.READY;
                }),
                switchMap(() => {
                    return this._geolocationService.getPosition();
                }),
                // Last, so the inner position watch is stopped too.
                takeUntil(this._geolocationStopSubject)
            )
            .subscribe((position) => {
                this._addPoint(position);
            });
    }

    onDestroy() {
        this._geolocationStopSubject.next(null);
        this._geolocationStopSubject.complete();
        this._wakeLockService.release();
    }

    save() {
        if (!this.averagedDataPoint) {
            return;
        }

        this._geolocationStopSubject.next(null);
        this._geolocationStopSubject.complete();
        this.point!.lat = this.averagedDataPoint.lat;
        this.point!.lon = this.averagedDataPoint.lon;
        this._waypointService.updatePoint(this.point!);
        history.go(-1);
    }

    toggleDistanceSystem() {
        this._distanceService.toggleSystem();
        this._recalc();
    }

    private _addPoint(position: GeolocationCoordinateResult) {
        if (!position.success) {
            return;
        }

        const last = this.dataPoints[this.dataPoints.length - 1];

        // The cached fix replayed on subscribe, or the initial
        // getCurrentPosition() answer, can repeat a fix. Counting it twice
        // would overstate how much data there is.
        if (last && last.timestamp === position.timestamp) {
            return;
        }

        const dataPoint: DataPoint = {
            ...this._coordinateService.latLonToXYZ(position),
            lat: position.lat,
            lon: position.lon,
            accuracy: position.accuracy,
            timestamp: position.timestamp,
        };
        this.dataPoints.push(dataPoint);
        this.pointCount = this.dataPoints.length;

        // See location-average-math.ts for how outliers are handled and how
        // the 95% radius accounts for GPS errors persisting for many minutes.
        const result = averageSamples(this.dataPoints);

        if (!result) {
            return;
        }

        this.ignoredCount = result.rejectedCount;

        const xyz: XYZ = { x: result.x, y: result.y, z: result.z };
        this.averagedDataPoint = {
            ...xyz,
            ...this._coordinateService.xyzToLatLon(xyz),
            accuracy: result.radius95,
            timestamp: position.timestamp,
        };
        this._recalc();
    }

    private _recalc() {
        if (this.averagedDataPoint) {
            this.ninetyFive = this._distanceService.metersToString(
                this.averagedDataPoint.accuracy
            );
        }
    }
}

component('location-average-app', {
    attr: ['id'],
    style: css`
        .content {
            height: 100%;
            width: 100%;
            max-width: 36rem;
            margin: 0 auto;
            display: flex;
            flex-direction: column;
            gap: var(--space-3);
            box-sizing: border-box;
            padding: var(--space-4);
            overflow: auto;
            /* Location screens scale their text up; this one has a lot to
               say, so it sets its own sizes. */
            font-size: 1rem;
        }

        .heading {
            color: var(--fg-muted);
        }

        .name {
            font-size: 1.4rem;
            font-weight: 700;
            color: var(--fg);
            overflow-wrap: anywhere;
        }

        .stats {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: var(--space-2);
        }

        .card {
            box-sizing: border-box;
            padding: var(--space-3);
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-l);
        }

        .stat {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            gap: 0.25rem;
            text-align: center;
        }

        .label {
            font-size: 0.8rem;
            color: var(--fg-muted);
        }

        .value {
            font-size: 1.35rem;
            font-weight: 700;
            font-variant-numeric: tabular-nums;
        }

        .coordinates {
            font-size: 1.35rem;
            font-weight: 600;
            font-variant-numeric: tabular-nums;
            text-align: center;
        }

        .help {
            font-size: 0.9rem;
            line-height: 1.45;
            color: var(--fg-muted);
        }

        .help p {
            margin: 0;
        }

        .help p + p {
            margin-top: var(--space-2);
        }
    `,
    template: html`
        <location-wrapper>
            <default-layout *if="point">
                <div class="content">
                    <div class="heading">
                        <i18n-label
                            id="location.average.heading"
                            ws=""
                        ></i18n-label>
                        <div class="name">{{point.name}}</div>
                    </div>
                    <div class="stats">
                        <div class="card stat">
                            <span class="label"
                                ><i18n-label
                                    id="location.average.pointsCollected"
                                    ws=""
                                ></i18n-label
                            ></span>
                            <span class="value">{{pointCount}}</span>
                        </div>
                        <div class="card stat">
                            <span class="label"
                                ><i18n-label
                                    id="location.average.pointsIgnored"
                                    ws=""
                                ></i18n-label
                            ></span>
                            <span class="value">{{ignoredCount}}</span>
                        </div>
                        <div class="card stat">
                            <span class="label"
                                ><i18n-label
                                    id="location.average.ninetyFive"
                                    ws=""
                                ></i18n-label
                            ></span>
                            <span class="value"
                                ><changeable-setting
                                    @click="toggleDistanceSystem()"
                                    >{{ninetyFive}}</changeable-setting
                                ></span
                            >
                        </div>
                    </div>
                    <div class="card coordinates">
                        <location-coordinates
                            .coords="averagedDataPoint"
                        ></location-coordinates>
                    </div>
                    <div class="help">
                        <p>
                            <i18n-label
                                id="location.average.help"
                                ws=""
                            ></i18n-label>
                        </p>
                        <p>
                            <i18n-label
                                id="location.average.help2"
                                ws=""
                            ></i18n-label>
                        </p>
                    </div>
                </div>
                <icon-button
                    slot="more-buttons"
                    @click.stop.prevent="save()"
                    href="/save.svg"
                    label-id="location.save"
                ></icon-button>
            </default-layout>
        </location-wrapper>
    `,
}, LocationAverageComponent);
