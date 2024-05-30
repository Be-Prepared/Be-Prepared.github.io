import { CoordinateService } from '../services/coordinate.service';
import { Component, css, di, html } from 'fudgel';
import { DirectionService } from '../services/direction.service';
import { GeolocationService } from '../services/geolocation.service';
import { I18nService } from '../i18n/i18n.service';
import { Subscription } from 'rxjs';

@Component('location-field-bearing', {
    attr: ['lat', 'lon'],
    style: css``,
    template: html`{{value}}`,
})
export class LocationFieldBearingComponent {
    private _coordinateService = di(CoordinateService);
    private _directionService = di(DirectionService);
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
                    const direction = this._coordinateService.bearing(
                        position,
                        { lat, lon }
                    );
                    this.value =
                        this._directionService.toHeadingDirection(direction);
                } else {
                    this.value = unknownValue;
                }
            });
    }

    onDestroy() {
        this._subscription && this._subscription.unsubscribe();
    }
}
