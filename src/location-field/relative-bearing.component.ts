import { component, css, html } from 'fudgel';
import { CoordinateService } from '../services/coordinate.service';
import {
    describeRelativeBearing,
    relativeBearing,
} from '../services/geolocation/navigation-math';
import { di } from '../di';
import { GeolocationService } from '../services/geolocation.service';
import { I18nService } from '../i18n/i18n.service';
import { MiniMustacheService } from '../services/mini-mustache.service';
import { Subscription } from 'rxjs';

// Which way to turn to face the destination, based on the direction of
// travel. GPS heading is meaningless while standing still, so it's unknown
// then.
export class LocationFieldRelativeBearingComponent {
    private _coordinateService = di(CoordinateService);
    private _geolocationService = di(GeolocationService);
    private _i18nService = di(I18nService);
    private _miniMustacheService = di(MiniMustacheService);
    private _subscription: Subscription | null = null;
    lat?: string;
    lon?: string;
    value: string;

    constructor() {
        this.value = this._i18nService.get('location.field.unknownValue');
    }

    onInit() {
        const lat = parseFloat(this.lat || '');
        const lon = parseFloat(this.lon || '');
        const unknownValue = this.value;

        this._subscription = this._geolocationService
            .getPosition()
            .subscribe((position) => {
                if (
                    !position ||
                    !position.success ||
                    !position.isMoving ||
                    isNaN(position.heading)
                ) {
                    this.value = unknownValue;
                    return;
                }

                const bearing = this._coordinateService.bearing(position, {
                    lat,
                    lon,
                });
                const { degrees, side } = describeRelativeBearing(
                    relativeBearing(bearing, position.heading)
                );
                this.value = this._miniMustacheService.parse(
                    this._i18nService.get(
                        `location.field.relativeBearing${side}`
                    ),
                    { degrees: `${degrees}` }
                );
            });
    }

    onDestroy() {
        this._subscription && this._subscription.unsubscribe();
    }
}

component('location-field-relative-bearing', {
    attr: ['lat', 'lon'],
    style: css``,
    template: html`{{value}}`,
}, LocationFieldRelativeBearingComponent);
