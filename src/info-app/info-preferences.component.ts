import { Component, css, di, html } from 'fudgel';
import {
    CoordinateService,
    COORDINATE_SYSTEMS,
    CoordinateSystemDefault,
} from '../services/coordinate.service';
import { CoordinateSystem } from '../datatypes/coordinate-system';
import {
    DistanceService,
    DISTANCE_SYSTEMS,
    DistanceSystemDefault,
} from '../services/distance.service';
import { DistanceSystem } from '../datatypes/distance-system';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ToastService } from '../services/toast.service';

@Component('info-preferences', {
    style: css``,
    template: html`
        <ul>
            <li>
                <i18n-label id="info.coordinates"></i18n-label>
                <pretty-select
                    i18n-base="location.coordinates"
                    value="{{coordinateSystem}}"
                    .options="coordinateSystems"
                    @change="changeCoordinateSystem($event.detail)"
                ></pretty-select>
            </li>
            <li>
                <i18n-label id="info.distances"></i18n-label>
                <pretty-select
                    i18n-base="info.distances"
                    value="{{distanceSystem}}"
                    .options="distanceSystems"
                    @change="changeDistanceSystem($event.detail)"
                ></pretty-select>
            </li>
            <li>
                <changeable-setting @click="reset()"
                    ><i18n-label id="info.preferences.reset"></i18n-label
                ></changeable-setting>
            </li>
        </ul>
    `,
})
export class InfoPreferencesComponent {
    private _coordinateService = di(CoordinateService);
    private _distanceService = di(DistanceService);
    private _subject = new Subject();
    private _toastService = di(ToastService);
    coordinateSystem: CoordinateSystem = CoordinateSystemDefault;
    coordinateSystems = COORDINATE_SYSTEMS;
    distanceSystem: DistanceSystem = DistanceSystemDefault;
    distanceSystems = DISTANCE_SYSTEMS;

    onInit() {
        this._coordinateService
            .getCurrentSetting()
            .pipe(takeUntil(this._subject))
            .subscribe((coordinateSystem) => {
                this.coordinateSystem = coordinateSystem;
            });
        this._distanceService
            .getCurrentSetting()
            .pipe(takeUntil(this._subject))
            .subscribe((value) => {
                this.distanceSystem = value;
            });
    }

    onDestroy() {
        this._subject.next(null);
        this._subject.complete();
    }

    changeCoordinateSystem(value: CoordinateSystem) {
        this._coordinateService.setCoordinateSystem(value);
    }

    changeDistanceSystem(value: DistanceSystem) {
        this._distanceService.setDistanceSystem(value);
    }

    reset() {
        this._coordinateService.reset();
        this._distanceService.reset();
        this._toastService.popI18n('info.preferences.resetComplete');
    }
}
