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
            if (position && position.success) {
                this.value = this.#distanceService.metersToString(
                    position.accuracy
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
