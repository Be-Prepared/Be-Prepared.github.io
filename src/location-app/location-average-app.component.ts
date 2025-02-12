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
import { LatLon } from '../datatypes/lat-lon';
import { Subject } from 'rxjs';
import { WakeLockService } from '../services/wake-lock.service';
import { WaypointSaved } from '../datatypes/waypoint-saved';
import { WaypointService } from './waypoint.service';
import { XYZ } from '../datatypes/xyz';

interface DataPoint extends XYZ, LatLon {
    accuracy: number;
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
                <scaling-icon
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
    private _geolocationService = di(GeolocationService);
    private _geolocationStopSubject = new Subject();
    private _wakeLockService = di(WakeLockService);
    private _waypointService = di(WaypointService);
    averagedDataPoint: DataPoint | null = null;
    dataPoints: DataPoint[] = [];
    debug = '';
    id?: string;
    ninetyFive = ''; // Distance to 95% of points
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
                takeUntil(this._geolocationStopSubject),
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

        let dataPoint: DataPoint = {
            ...this._coordinateService.latLonToXYZ(position),
            lat: position.lat,
            lon: position.lon,
            accuracy: position.accuracy || 20, // Default to 20m
        };
        this.dataPoints.push(dataPoint);
        this.pointCount = this.dataPoints.length;

        let weightedX = 0;
        let weightedY = 0;
        let weightedZ = 0;
        let totalWeight = 0;

        for (const point of this.dataPoints) {
            const weight = 1 / point.accuracy;
            weightedX += point.x * weight;
            weightedY += point.y * weight;
            weightedZ += point.z * weight;
            totalWeight += weight;
        }

        const xyz: XYZ = {
            x: weightedX / totalWeight,
            y: weightedY / totalWeight,
            z: weightedZ / totalWeight,
        };
        const latLon = this._coordinateService.xyzToLatLon(xyz);
        let deviationSquaredSum = 0;

        for (const point of this.dataPoints) {
            deviationSquaredSum += Math.pow(this._coordinateService.distance(latLon, point), 2);
        }

        const stdDev = Math.sqrt(deviationSquaredSum / this.dataPoints.length);
        this.averagedDataPoint = {
            ...xyz,
            ...latLon,
            // Multiplying by 20 allows the accuracy to be seen but is not correct.
            accuracy: stdDev * 20
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
