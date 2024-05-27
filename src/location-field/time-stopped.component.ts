import { Subscription } from 'rxjs';
import { Component, css, di, html } from 'fudgel';
import { GeolocationService } from '../services/geolocation.service';
import { I18nService } from '../i18n/i18n.service';
import { TimeService } from '../services/time.service';

@Component('location-field-time-stopped', {
    style: css``,
    template: html`{{value}}`,
})
export class LocationFieldTimeStoppedComponent {
    private _geolocationService = di(GeolocationService);
    private _i18nService = di(I18nService);
    private _subscription: Subscription | null = null;
    private _timeService = di(TimeService);
    value: string;

    constructor() {
        const unknownValue = this._i18nService.get(
            'location.field.unknownValue'
        );
        this.value = unknownValue;
        this._subscription = this._geolocationService
            .getPosition()
            .subscribe((position) => {
                if (position && position.success) {
                    this.value = this._timeService.formatTime(
                        position.timeStopped
                    );
                } else {
                    this.value = unknownValue;
                }
            });
    }

    onDestroy() {
        this._subscription && this._subscription.unsubscribe();
    }
}
