import { Component, css, di, html } from 'fudgel';
import { CoordinateService } from '../services/coordinate.service';
import { LatLon } from '../services/coordinate.service';
import { Subscription } from 'rxjs';

interface DataToDisplay {
    lat?: string | null;
    lon?: string | null;
    mgrs?: string | null;
    utmups?: string | null;
    empty?: boolean;
}

@Component('location-coordinates', {
    prop: ['coords'],
    style: css`
        .multi-line {
            display: flex;
            flex-direction: column;
            text-align: center;
        }
    `,
    template: html`
        <div *if="dataToDisplay.lat" class="multi-line">
            <changeable-setting @click="toggleCoordinateSystem()">
                <div>{{ dataToDisplay.lat }}</div>
                <div>{{ dataToDisplay.lon }}</div>
            </changeable-setting>
        </div>
        <div *if="dataToDisplay.mgrs" class="multi-line">
            <changeable-setting @click="toggleCoordinateSystem()">
                <div>
                    <i18n-label
                        id="location.coordinates.mgrs"
                        ws=""
                    ></i18n-label>
                </div>
                <div>{{ dataToDisplay.mgrs }}</div>
            </changeable-setting>
        </div>
        <div *if="dataToDisplay.utmups" class="multi-line">
            <changeable-setting @click="toggleCoordinateSystem()">
                <div>
                    <i18n-label
                        id="location.coordinates.utmups"
                        ws=""
                    ></i18n-label>
                </div>
                <div>{{ dataToDisplay.utmups }}</div>
            </changeable-setting>
        </div>
        <div *if="dataToDisplay.empty">
            <i18n-label id="location.coordinates.empty"></i18n-label>
        </div>
    `,
})
export class LocationCoordinatesComponent {
    private _coordinateService = di(CoordinateService);
    private _subscription: Subscription | null = null;
    coords?: LatLon;
    dataToDisplay: DataToDisplay = { empty: true };

    constructor() {
        this._subscription = this._coordinateService
            .getCurrentSetting()
            .subscribe(() => this._redraw());
    }

    onChange(prop: string) {
        if (prop === 'coords') {
            this._redraw();
        }
    }

    onDestroy() {
        this._subscription && this._subscription.unsubscribe();
    }

    toggleCoordinateSystem() {
        this._coordinateService.toggleSystem();
    }

    private _redraw() {
        if (!this.coords) {
            this.dataToDisplay = { empty: true };

            return;
        }

        const system = this._coordinateService.latLonToSystem(
            this.coords.lat,
            this.coords.lon,
        );

        // Tie to a single property for faster updates
        this.dataToDisplay = {
            lat: 'lat' in system ? system.lat : null,
            lon: 'lon' in system ? system.lon : null,
            mgrs: 'mgrs' in system ? system.mgrs : null,
            utmups: 'utmups' in system ? system.utmups : null,
        };
    }
}
