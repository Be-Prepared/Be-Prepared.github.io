import { combineLatest, Subscription } from 'rxjs';
import { component, css, html } from 'fudgel';
import { di } from '../di';
import { DistanceService } from '../services/distance.service';
import { DistanceSystem } from '../datatypes/distance-system';
import { formatVerticalSpeed } from '../services/geolocation/navigation-math';
import { GeolocationService } from '../services/geolocation.service';
import { I18nService } from '../i18n/i18n.service';

export class LocationFieldVerticalSpeedComponent {
    private _distanceService = di(DistanceService);
    private _geolocationService = di(GeolocationService);
    private _i18nService = di(I18nService);
    private _subscription: Subscription | null = null;
    value: string;

    constructor() {
        this.value = this._i18nService.get('location.field.unknownValue');
    }

    onInit() {
        const unknownValue = this.value;

        this._subscription = combineLatest([
            this._geolocationService.getPosition(),
            this._distanceService.getCurrentSetting(),
        ]).subscribe(([position, system]) => {
            if (
                position &&
                position.success &&
                !isNaN(position.vertical.verticalSpeed)
            ) {
                this.value = formatVerticalSpeed(
                    position.vertical.verticalSpeed,
                    system === DistanceSystem.METRIC,
                    true
                );
            } else {
                this.value = unknownValue;
            }
        });
    }

    onDestroy() {
        this._subscription && this._subscription.unsubscribe();
    }

    toggleDistanceSystem() {
        this._distanceService.toggleSystem();
    }
}

component('location-field-vertical-speed', {
    style: css``,
    template: html`
        <changeable-setting @click="toggleDistanceSystem()"
            >{{value}}</changeable-setting
        >
    `,
}, LocationFieldVerticalSpeedComponent);
