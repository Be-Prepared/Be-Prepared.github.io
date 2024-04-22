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
    style: css`
    `,
    template: html`
        <ul>
            <li>
                <i18n-label id="info.coordinates"></i18n-label>
                <changeable-setting @click="toggleCoordinates()">
                    <i18n-label id="info.coordinates.{{coordinates}}"></i18n-label>
                </changeable-setting>
            </li>
            <li>
                <i18n-label id="info.distances"></i18n-label>
                <changeable-setting @click="toggleDistances()">
                    <i18n-label id="info.distances.{{distances}}"></i18n-label>
                </changeable-setting>
            </li>
        </ul>
    `,
})
export class InfoPreferencesComponent {
    #coordinateService = di(CoordinateService);
    #distanceService = di(DistanceService);
    #subject = new Subject();
    coordinates = CoordinateSystemDefault;
    distances = DistanceSystemDefault;

    onInit() {
        this.#coordinateService
            .getCurrentSetting()
            .pipe(takeUntil(this.#subject))
            .subscribe((value) => {
                this.coordinates = value;
            });
        this.#distanceService
            .getCurrentSetting()
            .pipe(takeUntil(this.#subject))
            .subscribe((value) => {
                this.distances = value;
            });
    }

    onDestroy() {
        this.#subject.next(null);
    }

    toggleCoordinates() {
        this.#coordinateService.toggleSystem();
    }

    toggleDistances() {
        this.#distanceService.toggleSystem();
    }
}
