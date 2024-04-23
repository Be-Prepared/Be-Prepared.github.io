import { Component, css, di, html } from 'fudgel';
import { DirectionService } from '../services/direction.service';
import {
    GeolocationCoordinateResultSuccess,
    GeolocationService,
} from '../services/geolocation.service';
import { I18nService } from '../i18n/i18n.service';
import { Subscription } from 'rxjs';

@Component('location-field-heading', {
    style: css``,
    template: html`{{value}}`,
})
export class LocationFieldHeadingComponent {
    #directionService = di(DirectionService);
    #geolocationService = di(GeolocationService);
    #i18nService = di(I18nService);
    #subscription: Subscription | null = null;
    value: string;

    constructor() {
        const unknownValue = this.#i18nService.get(
            'location.field.unknownValue'
        );
        this.value = unknownValue;
        this.#subscription = this.#geolocationService
            .getPosition()
            .subscribe((position) => {
                if (position && position.timestamp) {
                    const positionTyped = position as GeolocationCoordinateResultSuccess;

                    if (isNaN(positionTyped.heading)) {
                        this.value = unknownValue;
                    } else {
                        this.value = this.#directionService.toHeadingDirection(
                            positionTyped.heading
                        );
                    }
                } else {
                    this.value = unknownValue;
                }
            });
    }

    onDestroy() {
        this.#subscription && this.#subscription.unsubscribe();
    }
}
