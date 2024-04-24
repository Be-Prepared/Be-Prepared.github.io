import { combineLatest, Subscription } from 'rxjs';
import { Component, css, di, html } from 'fudgel';
import { DistanceService } from '../services/distance.service';
import {
    GeolocationCoordinateResultSuccess,
    GeolocationService,
} from '../services/geolocation.service';
import { I18nService } from '../i18n/i18n.service';

@Component('location-field-speed', {
    style: css``,
    template: html`
        <changeable-setting @click="toggleDistanceSystem()"
            >{{value}}</changeable-setting
        >
    `,
})
export class LocationFieldSpeedComponent {
    #distanceService = di(DistanceService);
    #geolocationService = di(GeolocationService);
    #i18nService = di(I18nService);
    #subscription: Subscription | null = null;
    value: string;

    constructor() {
        const unknownValue = this.#i18nService.get(
            'location.field.unknownValue'
        );
        this.value = unknownValue;
        this.#subscription = combineLatest([
            this.#geolocationService.getPosition(),
            this.#distanceService.getCurrentSetting(),
        ]).subscribe(([position]) => {
            if (position && position.timestamp) {
                const positionTyped =
                    position as GeolocationCoordinateResultSuccess;

                this.value = this.#distanceService.metersToString(
                    positionTyped.speed,
                    {
                        isSpeed: true
                    }
                );
            } else {
                this.value = unknownValue;
            }
        });
    }

    onDestroy() {
        this.#subscription && this.#subscription.unsubscribe();
    }

    toggleDistanceSystem() {
        this.#distanceService.toggleSystem();
    }
}