import { component, css, html } from 'fudgel';
import { CoordinateService } from '../services/coordinate.service';
import { di } from '../di';
import { DistanceService } from '../services/distance.service';
import { GeolocationService } from '../services/geolocation.service';
import { I18nService } from '../i18n/i18n.service';
import { Subscription } from 'rxjs';
import { velocityMadeGood } from '../services/geolocation/navigation-math';

// How fast the distance to the destination is shrinking: speed times the
// cosine of the angle between the direction of travel and the destination.
// Negative while moving away.
export class LocationFieldVelocityMadeGoodComponent {
    private _coordinateService = di(CoordinateService);
    private _distanceService = di(DistanceService);
    private _geolocationService = di(GeolocationService);
    private _i18nService = di(I18nService);
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
                if (!position || !position.success) {
                    this.value = unknownValue;
                    return;
                }

                // Below walking pace the GPS heading is noise; report no
                // progress instead of a random sign.
                const speed = position.isMoving ? position.speed : 0;
                const bearing = this._coordinateService.bearing(position, {
                    lat,
                    lon,
                });
                const vmg = velocityMadeGood(speed, bearing, position.heading);
                this.value = isNaN(vmg)
                    ? unknownValue
                    : this._distanceService.metersToString(vmg, {
                          isSpeed: true,
                      });
            });
    }

    onDestroy() {
        this._subscription && this._subscription.unsubscribe();
    }

    toggleDistanceSystem() {
        this._distanceService.toggleSystem();
    }
}

component('location-field-velocity-made-good', {
    attr: ['lat', 'lon'],
    style: css``,
    template: html`
        <changeable-setting @click="toggleDistanceSystem()"
            >{{value}}</changeable-setting
        >
    `,
}, LocationFieldVelocityMadeGoodComponent);
