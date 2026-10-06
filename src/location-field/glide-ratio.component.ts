import { component, css, html } from 'fudgel';
import { di } from '../di';
import { formatGlideRatio } from '../services/geolocation/navigation-math';
import { GeolocationService } from '../services/geolocation.service';
import { glideRatio } from '../services/geolocation/vertical';
import { I18nService } from '../i18n/i18n.service';
import { MiniMustacheService } from '../services/mini-mustache.service';
import { Subscription } from 'rxjs';

export class LocationFieldGlideRatioComponent {
    private _geolocationService = di(GeolocationService);
    private _i18nService = di(I18nService);
    private _miniMustacheService = di(MiniMustacheService);
    private _subscription: Subscription | null = null;
    value: string;

    constructor() {
        this.value = this._i18nService.get('location.field.unknownValue');
    }

    onInit() {
        const unknownValue = this.value;
        const notDescending = this._i18nService.get(
            'location.field.glideRatioNotDescending'
        );
        const template = this._i18nService.get(
            'location.field.glideRatioValue'
        );

        this._subscription = this._geolocationService
            .getPosition()
            .subscribe((position) => {
                if (!position || !position.success) {
                    this.value = unknownValue;
                    return;
                }

                const ratio = glideRatio(position.vertical);
                this.value = isNaN(ratio)
                    ? notDescending
                    : this._miniMustacheService.parse(template, {
                          ratio: formatGlideRatio(ratio),
                      });
            });
    }

    onDestroy() {
        this._subscription && this._subscription.unsubscribe();
    }
}

component('location-field-glide-ratio', {
    style: css``,
    template: html`{{value}}`,
}, LocationFieldGlideRatioComponent);
