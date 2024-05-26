import CheapRuler from 'cheap-ruler';
import { combineLatest, Subscription } from 'rxjs';
import { Component, css, di, html } from 'fudgel';
import { GeolocationService } from '../services/geolocation.service';
import { I18nService } from '../i18n/i18n.service';
import { TimeService } from '../services/time.service';

@Component('location-field-time-remaining', {
    attr: ['lat', 'lon'],
    style: css``,
    template: html`{{value}}`,
})
export class LocationFieldTimeRemainingComponent {
    private _geolocationService = di(GeolocationService);
    private _i18nService = di(I18nService);
    private _subscription: Subscription | null = null;
    private _timeService = di(TimeService);
    lat?: string;
    lon?: string;
    value: string;

    constructor() {
        const unknownValue = this._i18nService.get(
            'location.field.unknownValue',
        );
        this.value = unknownValue;
    }

    onInit() {
        const lat = parseFloat(this.lat || '')
        const lon = parseFloat(this.lon || '')
        const unknownValue = this.value;

        this._subscription = combineLatest([
            this._geolocationService.getPosition(),
        ]).subscribe(([position]) => {
            this.value = unknownValue;

            if (position && position.success && position.firstPosition) {
                const cheapRuler = new CheapRuler(position.latitude, 'meters');
                const startingPosition = position.firstPosition;
                const distanceAchieved = cheapRuler.distance(
                    [startingPosition.longitude, startingPosition.latitude],
                    [position.longitude, position.latitude],
                );
                const distanceRemaining = cheapRuler.distance(
                    [startingPosition.longitude, startingPosition.latitude],
                    [lon, lat],
                );
                const timeElapsed = position.timestamp - position.firstPosition.timestamp;
                const overallSpeed = distanceAchieved / timeElapsed;

                if (overallSpeed > 0) {
                    const timeRemaining = distanceRemaining / overallSpeed;
                    this.value = this._timeService.formatTime(timeRemaining);
                }
            }
        });
    }

    onDestroy() {
        this._subscription && this._subscription.unsubscribe();
    }
}
