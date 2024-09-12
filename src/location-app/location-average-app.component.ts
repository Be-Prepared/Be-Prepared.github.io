import { AvailabilityState } from '../datatypes/availability-state';
import { Component, css, html } from 'fudgel';
import { CoordinateService } from '../services/coordinate.service';
import { di } from '../di';
import { DistanceService } from '../services/distance.service';
import { filter, switchMap, takeUntil } from 'rxjs/operators';
import {
    GeolocationCoordinateResult,
    GeolocationService,
} from '../services/geolocation.service';
import { KalmanFilterArray } from '@bencevans/kalman-filter';
import { LatLon } from '../datatypes/lat-lon';
import { Subject } from 'rxjs';
import { WakeLockService } from '../services/wake-lock.service';
import { WaypointSaved } from '../datatypes/waypoint-saved';
import { WaypointService } from './waypoint.service';
import { XYZ } from '../datatypes/xyz';

interface DataPoint extends XYZ, LatLon {
    accuracy: number;
}

interface TestPoint extends DataPoint {
    dist2: number;
    weighed: number;
}

@Component('location-average-app', {
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
                            *if="!saving"
                            id="location.average.heading"
                        ></i18n-label>
                        <i18n-label
                            *if="saving"
                            id="location.average.calculating"
                        ></i18n-label>
                        <div>{{point.name}}</div>
                    </div>
                    <div class="wrapper">
                        <div class="wrapper-inner" *if="!saving">
                            <div>
                                <i18n-label
                                    id="location.average.pointsCollected"
                                ></i18n-label>
                                {{pointCount}}
                            </div>
                            <div>
                                <i18n-label
                                    id="location.average.acc"
                                ></i18n-label>
                                <changeable-setting
                                    @click="toggleDistanceSystem()"
                                    >{{acc}}</changeable-setting
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
                        <div *if="saving" class="wrapper-inner">
                            <div>
                                <i18n-label
                                    id="location.average.currentEstimate"
                                ></i18n-label>
                            </div>
                            <location-coordinates
                                .coords="averagedDataPoint"
                            ></location-coordinates>
                            <div>
                                <i18n-label
                                    id="location.average.xDelta"
                                ></i18n-label>
                                {{xDelta}}
                            </div>
                            <div>
                                <i18n-label
                                    id="location.average.yDelta"
                                ></i18n-label>
                                {{yDelta}}
                            </div>
                        </div>
                    </div>
                </div>
                <scaling-icon
                    *if="!saving"
                    slot="more-buttons"
                    @click.stop.prevent="save()"
                    href="/save.svg"
                ></scaling-icon>
            </default-layout>
        </location-wrapper>
    `,
})
export class LocationAverageComponent {
    private _coordinateService = di(CoordinateService);
    private _distanceService = di(DistanceService);
    private _filter: KalmanFilterArray | null = null;
    private _geolocationService = di(GeolocationService);
    private _subject = new Subject();
    private _wakeLockService = di(WakeLockService);
    private _waypointService = di(WaypointService);
    private _xDelta = 0;
    private _yDelta = 0;
    acc = '0';
    averagedDataPoint: DataPoint | null = null;
    dataPoints: DataPoint[] = [];
    id?: string;
    point: WaypointSaved | null = null;
    pointCount = 0;
    saving = false;
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
                takeUntil(this._subject),
                filter((state) => {
                    return state === AvailabilityState.ALLOWED;
                }),
                switchMap(() => {
                    return this._geolocationService.getPosition();
                })
            )
            .subscribe((position) => {
                this._addPoint(position);
            });
    }

    onDestroy() {
        this._subject.next(null);
        this._subject.complete();
        this._wakeLockService.release();
    }

    save() {
        if (!this.averagedDataPoint) {
            return;
        }

        this._subject.next(null);
        this._subject.complete();
        this.saving = true;
        let xMin = Number.POSITIVE_INFINITY;
        let xMax = Number.NEGATIVE_INFINITY;
        let yMin = Number.POSITIVE_INFINITY;
        let yMax = Number.NEGATIVE_INFINITY;

        for (const point of this.dataPoints) {
            xMin = Math.min(xMin, point.x);
            xMax = Math.max(xMax, point.x);
            yMin = Math.min(yMin, point.y);
            yMax = Math.max(yMax, point.y);
        }

        this._xDelta = xMax - xMin;
        this.xDelta = this._xDelta.toFixed(7);
        this._yDelta = yMax - yMin;
        this.yDelta = this._yDelta.toFixed(7);
        this._scheduleLeastSquares();
    }

    toggleDistanceSystem() {
        this._distanceService.toggleSystem();
        this._recalc();
    }

    private _addPoint(position: GeolocationCoordinateResult) {
        if (!position.success) {
            return;
        }

        let dataPoint: DataPoint = {
            ...this._coordinateService.latLonToXYZ(position),
            lat: position.lat,
            lon: position.lon,
            accuracy: position.accuracy || 1,
        };
        this.dataPoints.push(dataPoint);
        this.pointCount = this.dataPoints.length;

        if (!this._filter) {
            this._filter = new KalmanFilterArray({
                initialEstimate: [dataPoint.x, dataPoint.y, dataPoint.z],
                initialErrorInEstimate: dataPoint.accuracy,
            });
            this.averagedDataPoint = {
                ...dataPoint,
            };
        } else {
            const xyzAvg = this._filter.update({
                measurement: [dataPoint.x, dataPoint.y, dataPoint.z],
                errorInMeasurement: dataPoint.accuracy,
            });
            const xyz: XYZ = {
                x: xyzAvg[0][0],
                y: xyzAvg[0][1],
                z: xyzAvg[0][2],
            };
            const latLon = this._coordinateService.xyzToLatLon(xyz);

            this.averagedDataPoint = {
                ...xyz,
                ...latLon,
                accuracy: xyzAvg[1],
            };
        }

        this._recalc();
    }

    private _finishSave() {
        if (!this.averagedDataPoint) {
            return;
        }

        this.point!.lat = this.averagedDataPoint.lat;
        this.point!.lon = this.averagedDataPoint.lon;
        this._waypointService.updatePoint(this.point!);
        history.go(-1);
    }

    private _leastSquares() {
        const testPoints = this._leastSquaresPoints();

        for (const point of this.dataPoints) {
            for (const testPoint of testPoints) {
                const distance = this._coordinateService.distance(
                    testPoint,
                    point
                );
                const dist2 = distance * distance;
                testPoint.dist2 += dist2;
                testPoint.weighed = dist2 / point.accuracy;
            }
        }

        let best: TestPoint = testPoints[0];

        for (const testPoint of testPoints) {
            if (testPoint.weighed < best.weighed) {
                best = testPoint;
            }
        }

        this.averagedDataPoint = best;

        if (Math.max(this._xDelta, this._yDelta) > 0.000001) {
            this._scheduleLeastSquares();
        } else {
            this._finishSave();
        }
    }

    private _leastSquaresPoints() {
        const middle = this.averagedDataPoint;

        if (!middle) {
            return [];
        }

        let xDelta = 0;
        let yDelta = 0;

        if (this.xDelta > this.yDelta) {
            this._xDelta *= 0.2;
            this.xDelta = this._xDelta.toFixed(7);
            xDelta = this._xDelta;
        } else {
            this._yDelta *= 0.8;
            this.yDelta = this._yDelta.toFixed(7);
            yDelta = this._yDelta;
        }

        return [
            this._testPoint(middle, -xDelta * 4, -yDelta * 4),
            this._testPoint(middle, -xDelta * 3, -yDelta * 3),
            this._testPoint(middle, -xDelta * 2, -yDelta * 2),
            this._testPoint(middle, -xDelta, -yDelta),
            this._testPoint(middle, 0, 0),
            this._testPoint(middle, xDelta, yDelta),
            this._testPoint(middle, xDelta * 2, yDelta * 2),
            this._testPoint(middle, xDelta * 3, yDelta * 3),
            this._testPoint(middle, xDelta * 4, yDelta * 4),
        ];
    }

    private _recalc() {
        if (this.averagedDataPoint) {
            this.acc = this._distanceService.metersToString(
                this.averagedDataPoint.accuracy
            );
        }
    }

    private _scheduleLeastSquares() {
        setTimeout(() => {
            this._leastSquares();
        });
    }

    private _testPoint(
        dataPoint: DataPoint,
        xDelta: number,
        yDelta: number
    ): TestPoint {
        return {
            ...this._coordinateService.xyzToLatLon(dataPoint),
            x: dataPoint.x + xDelta,
            y: dataPoint.y + yDelta,
            z: dataPoint.z,
            accuracy: dataPoint.accuracy,
            dist2: 0,
            weighed: 0,
        };
    }
}
