import { Component, css, di, html } from 'fudgel';
import { CoordinateService } from '../services/coordinate.service';
import { DistanceService } from '../services/distance.service';
import { GeolocationService } from '../services/geolocation.service';
import { I18nService } from '../i18n/i18n.service';
import { Subscription } from 'rxjs';

@Component('location-field-distance', {
    attr: ['lat', 'lon'],
    style: css``,
    template: html`
        <changeable-setting @click="toggleDistanceSystem()"
            >{{value}}</changeable-setting
        >
    `,
})
export class LocationFieldDistanceComponent {
    private _coordinateService = di(CoordinateService);
    private _distanceService = di(DistanceService);
    private _geolocationService = di(GeolocationService);
    private _i18nService = di(I18nService);
    private _subscription: Subscription | null = null;
    lat?: string;
    lon?: string;
    value: string;

    constructor() {
        const unknownValue = this._i18nService.get(
            'location.field.unknownValue'
        );
        this.value = unknownValue;
    }

    onInit() {
        const lat = parseFloat(this.lat || '');
        const lon = parseFloat(this.lon || '');
        const unknownValue = this.value;

        this._subscription = this._geolocationService
            .getPosition()
            .subscribe((position) => {
                if (position && position.success) {
                    const distance = this._coordinateService.distance(
                        { lon, lat },
                        position
                    );
                    this.value = this._distanceService.metersToString(distance);
                } else {
                    this.value = unknownValue;
                }
            });
    }

    onDestroy() {
        this._subscription && this._subscription.unsubscribe();
    }

    toggleDistanceSystem() {
        this._distanceService.toggleSystem();
    }
}
