import CheapRuler from 'cheap-ruler';
import { Component, css, di, html } from 'fudgel';
import {
    GeolocationCoordinateResultSuccess,
    GeolocationService,
} from '../services/geolocation.service';
import { I18nService } from '../i18n/i18n.service';
import { Subscription } from 'rxjs';
import { TimeService } from '../services/time.service';

@Component('location-field-time-arrival', {
    attr: ['lat', 'lon', 'startPosition', 'startTime'],
    style: css``,
    template: html`
        <changeable-setting @click="toggleTimeSystem()"
            >{{value}}</changeable-setting
        >
    `,
})
export class LocationFieldTimeArrivalComponent {
    private _geolocationService = di(GeolocationService);
    private _i18nService = di(I18nService);
    private _subscription: Subscription | null = null;
    private _timeService = di(TimeService);
    lat?: string;
    lon?: string;
    startPosition?: GeolocationCoordinateResultSuccess;
    startTime?: string;
    value: string = '';

    onInit() {
        const unknownValue = this._i18nService.get(
            'location.field.unknownValue'
        );
        const lat = parseFloat(this.lat || '');
        const lon = parseFloat(this.lon || '');
        const startTime = parseInt(this.startTime || '', 10);
        this.value = unknownValue;

        this._subscription = this._geolocationService
            .getPosition()
            .subscribe((position) => {
                if (
                    position &&
                    position.success &&
                    this.startPosition &&
                    position !== this.startPosition
                ) {
                    const cheapRuler = new CheapRuler(
                        position.latitude,
                        'meters'
                    );
                    const distanceAchieved = cheapRuler.distance(
                        [
                            this.startPosition.longitude,
                            this.startPosition.latitude,
                        ],
                        [position.longitude, position.latitude]
                    );
                    const distanceRemaining = cheapRuler.distance(
                        [
                            this.startPosition.longitude,
                            this.startPosition.latitude,
                        ],
                        [lon, lat]
                    );
                    const timeElapsed = position.timestamp - startTime;
                    const overallSpeed = distanceAchieved / timeElapsed;

                    if (overallSpeed > 0) {
                        const timeRemaining = distanceRemaining / overallSpeed;
                        this.value = this._timeService.formatTimeOfDay(
                            Date.now() + timeRemaining
                        );
                    }
                } else {
                    this.value = unknownValue;
                }
            });
    }

    onDestroy() {
        this._subscription && this._subscription.unsubscribe();
    }

    toggleTimeSystem() {
        this._timeService.toggleSystem();
    }
}
