import { Component, css, di, html } from 'fudgel';
import {
    CoordinateService,
    CoordinateSystemDefault,
} from '../services/coordinate.service';
import {
    DistanceService,
    DistanceSystemDefault,
} from '../services/distance.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component('info-preferences', {
    style: css``,
    template: html`
        <ul>
            <li>
                <i18n-label id="info.coordinates"></i18n-label>
                <changeable-setting @click="toggleCoordinates()">
                    <i18n-label
                        id="info.coordinates.{{coordinates}}"
                    ></i18n-label>
                </changeable-setting>
            </li>
            <li>
                <i18n-label id="info.distances"></i18n-label>
                <changeable-setting @click="toggleDistances()">
                    <i18n-label id="info.distances.{{distances}}"></i18n-label>
                </changeable-setting>
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
    coordinates = CoordinateSystemDefault;
    distances = DistanceSystemDefault;

    onInit() {
        this._coordinateService
            .getCurrentSetting()
            .pipe(takeUntil(this._subject))
            .subscribe((value) => {
                this.coordinates = value;
            });
        this._distanceService
            .getCurrentSetting()
            .pipe(takeUntil(this._subject))
            .subscribe((value) => {
                this.distances = value;
            });
    }

    onDestroy() {
        this._subject.next(null);
        this._subject.complete();
    }

    reset() {
        this._coordinateService.reset();
        this._distanceService.reset();
    }

    toggleCoordinates() {
        this._coordinateService.toggleSystem();
    }

    toggleDistances() {
        this._distanceService.toggleSystem();
    }
}
