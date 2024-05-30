import { Component, css, di, html } from 'fudgel';
import {
    CoordinateService,
    CoordinateSystemDefault,
    COORDINATE_SYSTEMS,
    SystemCoordinates,
} from '../services/coordinate.service';
import { CoordinateSystem } from '../datatypes/coordinate-system';
import { LatLon } from '../datatypes/lat-lon';
import { Subscription } from 'rxjs';

interface EmptyData {
    empty: boolean;
}

@Component('location-coordinates', {
    prop: ['coords'],
    style: css`
        :host {
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .multi-line {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
        }
    `,
    template: html`
        <pretty-select
            i18n-base="location.coordinates"
            value="{{coordinateSystem}}"
            .options="coordinateSystems"
            @change="changeCoordinateSystem($event.detail)"
        ></pretty-select>
        <div *if="dataToDisplay.lat" class="multi-line">
            <div>{{ dataToDisplay.lat }}</div>
            <div>{{ dataToDisplay.lon }}</div>
        </div>
        <div *if="dataToDisplay.mgrs" class="multi-line">
            <div>{{ dataToDisplay.mgrs }}</div>
        </div>
        <div *if="dataToDisplay.utmups" class="multi-line">
            <div>{{ dataToDisplay.utmups }}</div>
        </div>
        <div *if="dataToDisplay.empty">
            <i18n-label id="location.coordinates.empty"></i18n-label>
        </div>
    `,
})
export class LocationCoordinatesComponent {
    private _coordinateService = di(CoordinateService);
    private _subscription: Subscription | null = null;
    coordinateSystem: CoordinateSystem = CoordinateSystemDefault;
    coordinateSystems = COORDINATE_SYSTEMS;
    coords?: LatLon;
    dataToDisplay: SystemCoordinates | EmptyData = { empty: true };

    constructor() {
        this._subscription = this._coordinateService
            .getCurrentSetting()
            .subscribe((coordinateSystem) => {
                this.coordinateSystem = coordinateSystem;
                this._redraw();
            });
    }

    onChange(prop: string) {
        if (prop === 'coords') {
            this._redraw();
        }
    }

    onDestroy() {
        this._subscription && this._subscription.unsubscribe();
    }

    changeCoordinateSystem(value: CoordinateSystem) {
        this._coordinateService.setCoordinateSystem(value);
    }

    private _redraw() {
        if (!this.coords) {
            this.dataToDisplay = { empty: true };

            return;
        }

        this.dataToDisplay = this._coordinateService.latLonToSystem(
            this.coords.lat,
            this.coords.lon
        );
    }
}
