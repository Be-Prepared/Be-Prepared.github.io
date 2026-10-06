import { ascentSummary, descentSummary } from '../services/geolocation/vertical';
import { combineLatest, Subscription } from 'rxjs';
import { component, css, html } from 'fudgel';
import { di } from '../di';
import { DistanceService } from '../services/distance.service';
import { DistanceSystem } from '../datatypes/distance-system';
import { formatVerticalSpeed } from '../services/geolocation/navigation-math';
import { GeolocationService } from '../services/geolocation.service';
import { I18nService } from '../i18n/i18n.service';

// One component for the eight ascent and descent fields. `kind` is the field
// name, such as ASCENT_TOTAL or DESCENT_MAXIMUM. Definitions are documented
// in services/geolocation/vertical.ts.
export class LocationFieldClimbComponent {
    private _distanceService = di(DistanceService);
    private _geolocationService = di(GeolocationService);
    private _i18nService = di(I18nService);
    private _subscription: Subscription | null = null;
    kind?: string;
    value: string;

    constructor() {
        this.value = this._i18nService.get('location.field.unknownValue');
    }

    onInit() {
        const unknownValue = this.value;
        const [direction, statistic] = (this.kind || '').split('_');

        this._subscription = combineLatest([
            this._geolocationService.getPosition(),
            this._distanceService.getCurrentSetting(),
        ]).subscribe(([position, system]) => {
            if (!position || !position.success) {
                this.value = unknownValue;
                return;
            }

            const summary =
                direction === 'DESCENT'
                    ? descentSummary(position.vertical)
                    : ascentSummary(position.vertical);

            if (statistic === 'TOTAL') {
                this.value = this._distanceService.metersToString(
                    summary.total,
                    { useSmallUnits: true }
                );
                return;
            }

            const rate =
                statistic === 'MINIMUM'
                    ? summary.minimum
                    : statistic === 'MAXIMUM'
                      ? summary.maximum
                      : summary.average;
            this.value = isNaN(rate)
                ? unknownValue
                : formatVerticalSpeed(rate, system === DistanceSystem.METRIC);
        });
    }

    onDestroy() {
        this._subscription && this._subscription.unsubscribe();
    }

    toggleDistanceSystem() {
        this._distanceService.toggleSystem();
    }
}

component('location-field-climb', {
    attr: ['kind'],
    style: css``,
    template: html`
        <changeable-setting @click="toggleDistanceSystem()"
            >{{value}}</changeable-setting
        >
    `,
}, LocationFieldClimbComponent);
