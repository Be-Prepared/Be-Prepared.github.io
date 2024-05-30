import { combineLatest, Subscription } from 'rxjs';
import { Component, css, di, html } from 'fudgel';
import { DistanceService } from '../services/distance.service';
import { GeolocationService } from '../services/geolocation.service';
import { I18nService } from '../i18n/i18n.service';

@Component('location-field-accuracy', {
    style: css``,
    template: html`
        <changeable-setting @click="toggleDistanceSystem()"
            >{{value}}</changeable-setting
        >
    `,
})
export class LocationFieldAccuracyComponent {
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
        this._subscription = combineLatest([
            this._geolocationService.getPosition(),
            this._distanceService.getCurrentSetting(),
        ]).subscribe(([position]) => {
            if (position && position.success) {
                this.value = this._distanceService.metersToString(
                    position.accuracy
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
