import { Component, css, html } from 'fudgel';
import { di } from '../di';
import { DistanceService } from '../services/distance.service';
import { GeolocationService } from '../services/geolocation.service';
import { I18nService } from '../i18n/i18n.service';
import { Subscription } from 'rxjs';

@Component('location-field-altitude-minimum', {
    style: css``,
    template: html`
        <changeable-setting @click="toggleDistanceSystem()"
            >{{value}}</changeable-setting
        >
    `,
})
export class LocationFieldAltitudeMinimumComponent {
    private _distanceService = di(DistanceService);
    private _geolocationService = di(GeolocationService);
    private _i18nService = di(I18nService);
    private _subscription: Subscription | null = null;
    value: string;

    constructor() {
        const unknownValue = this._i18nService.get(
            'location.field.unknownValue'
        );
        this.value = unknownValue;
        this._subscription = this._geolocationService
            .getPosition()
            .subscribe((position) => {
                if (
                    position &&
                    position.success &&
                    !isNaN(position.altitudeMinimum)
                ) {
                    this.value = this._distanceService.metersToString(
                        position.altitudeMinimum,
                        {
                            useSmallUnits: true,
                        }
                    );
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
