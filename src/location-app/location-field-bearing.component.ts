import CheapRuler from 'cheap-ruler';
import { Component, css, di, html } from 'fudgel';
import { DirectionService } from '../services/direction.service';
import { GeolocationService } from '../services/geolocation.service';
import { I18nService } from '../i18n/i18n.service';
import { Subscription } from 'rxjs';

@Component('location-field-bearing', {
    attr: ['lat', 'lon'],
    style: css``,
    template: html`{{value}}`,
})
export class LocationFieldBearingComponent {
    #directionService = di(DirectionService);
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
                    const direction = cheapRuler.bearing(
                        [position.longitude, position.latitude],
                        [lon, lat]
                    );
                    this.value = this.#directionService.toHeadingDirection(
                        direction
                    );
                } else {
                    this.value = unknownValue;
                }
            });
    }

    onDestroy() {
        this.#subscription && this.#subscription.unsubscribe();
    }
}
