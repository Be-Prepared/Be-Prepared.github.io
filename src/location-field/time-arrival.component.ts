import { component, css, html } from 'fudgel';
import { CoordinateService } from '../services/coordinate.service';
import { di } from '../di';
import {
    GeolocationCoordinateResultSuccess,
    GeolocationService,
} from '../services/geolocation.service';
import { I18nService } from '../i18n/i18n.service';
import { Subscription } from 'rxjs';
import { estimateTimeRemaining } from './time-estimate';
import { TimeService } from '../services/time.service';

export class LocationFieldTimeArrivalComponent {
    private _coordinateService = di(CoordinateService);
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
        this.value = unknownValue;

        this._subscription = this._geolocationService
            .getPosition()
            .subscribe((position) => {
                const timeRemaining =
                    position &&
                    position.success &&
                    this.startPosition &&
                    estimateTimeRemaining(
                        this.startPosition,
                        position,
                        { lat, lon },
                        (a, b) => this._coordinateService.distance(a, b)
                    );

                if (typeof timeRemaining === 'number') {
                    this.value = this._timeService.formatTimeOfDay(
                        Date.now() + timeRemaining
                    );
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

component('location-field-time-arrival', {
    attr: ['lat', 'lon', 'startTime'],
    prop: ['startPosition'],
    style: css``,
    template: html`
        <changeable-setting @click="toggleTimeSystem()"
            >{{value}}</changeable-setting
        >
    `,
}, LocationFieldTimeArrivalComponent);
