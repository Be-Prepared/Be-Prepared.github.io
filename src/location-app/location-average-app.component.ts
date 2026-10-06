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

        // See location-average-math.ts for the weighting and how the 95%
        // radius accounts for GPS errors persisting for minutes.
        const result = averageSamples(this.dataPoints);

        if (!result) {
            return;
        }

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
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
        }

        .wrapper {
            padding-top: 1em;
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
    `,
    template: html`
        <location-wrapper>
            <default-layout *if="point">
                <div class="content">
                    <div>
                        <i18n-label
                            id="location.average.heading"
                        ></i18n-label>
                        <div>{{point.name}}</div>
                    </div>
                    <div class="wrapper">
                        <div class="wrapper-inner">
                            <div>
                                <i18n-label
                                    id="location.average.pointsCollected"
                                ></i18n-label>
                                {{pointCount}}
                            </div>
                            <div>
                                <i18n-label
                                    id="location.average.ninetyFive"
                                ></i18n-label>
                                <changeable-setting
                                    @click="toggleDistanceSystem()"
                                    >{{ninetyFive}}</changeable-setting
                                >
                            </div>
                            <location-coordinates
                                .coords="averagedDataPoint"
                            ></location-coordinates>
                            <p>
                                <i18n-label
                                    id="location.average.help"
                                ></i18n-label>
                            </p>
                            <p>
                                <i18n-label
                                    id="location.average.help2"
                                ></i18n-label>
                            </p>
                        </div>
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
