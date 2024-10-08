import { Component, css, html } from 'fudgel';
import { di } from '../di';
import { DirectionService } from '../services/direction.service';
import { GeolocationService } from '../services/geolocation.service';
import { I18nService } from '../i18n/i18n.service';
import { Subscription } from 'rxjs';

@Component('location-field-heading', {
    style: css``,
    template: html`{{value}}`,
})
export class LocationFieldHeadingComponent {
    private _directionService = di(DirectionService);
    private _geolocationService = di(GeolocationService);
    private _i18nService = di(I18nService);
    private _subscription: Subscription | null = null;
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
                    if (isNaN(position.heading)) {
                        this.value = unknownValue;
                    } else {
                        this.value = this._directionService.toHeadingDirection(
                            position.heading
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
}
