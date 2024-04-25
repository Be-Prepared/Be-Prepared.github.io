import CheapRuler from 'cheap-ruler';
import { Component, css, di, html } from 'fudgel';
import { DistanceService } from '../services/distance.service';
import { GeolocationService } from '../services/geolocation.service';
import { I18nService } from '../i18n/i18n.service';
import { Subscription } from 'rxjs';

@Component('location-field-distance', {
    attr: ['lat', 'lon'],
    style: css``,
    template: html`
        <changeable-setting @click="toggleDistanceSystem()"
            >{{value}}</changeable-setting
        >
    `,
})
export class LocationFieldDistanceComponent {
    #distanceService = di(DistanceService);
    #geolocationService = di(GeolocationService);
    #i18nService = di(I18nService);
    #subscription: Subscription | null = null;
    lat?: string;
    lon?: string;
    value: string;

    constructor() {
        const unknownValue = this.#i18nService.get(
            'location.field.unknownValue'
        );
        this.value = unknownValue;
    }

    onInit() {
        const lat = parseFloat(this.lat || '');
        const lon = parseFloat(this.lon || '');
        const unknownValue = this.value;

        this.#subscription = this.#geolocationService
            .getPosition()
            .subscribe((position) => {
                if (position && position.success) {
                    const cheapRuler = new CheapRuler(
                        position.latitude,
                        'meters'
                    );
                    const distance = cheapRuler.distance(
                        [lon, lat],
                        [position.longitude, position.latitude]
                    );
                    this.value = this.#distanceService.metersToString(distance);
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
