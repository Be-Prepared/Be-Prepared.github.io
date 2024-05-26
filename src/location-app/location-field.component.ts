import { Component, css, di, html } from 'fudgel';
import { GeolocationCoordinateResultSuccess } from '../services/geolocation.service';
import { LocalStorageInterface } from '../services/local-storage.service';
import { PreferenceService } from '../services/preference.service';

@Component('location-field', {
    attr: ['default', 'id', 'lat', 'lon', 'name', 'startTime'],
    prop: ['startPosition'],
    style: css`
        :host {
            max-width: 100%;
        }

        .field-line {
            display: flex;
            overflow: hidden;
            width: 100%;
            justify-content: center;
            align-items: center;
        }

        .field-label-wrapper {
            display: inline-block;
            padding-right: 0.4em;
        }

        .field-value-wrapper {
            flex-shrink: 1;
            overflow: hidden;
        }

        .field-label {
            position: relative;
            display: inline-block;
        }

        .hidden-select {
            position: absolute;
            inset: 0;
            opacity: 0;
            font-size: inherit;
            cursor: pointer;
        }
    `,
    template: html`
        <div class="field-line">
            <div class="field-label-wrapper">
                <pretty-select
                    i18n-base="location.field"
                    value="{{selectedValue}}"
                    .options="allowedFields"
                    @change="selectValue($event.detail)"
                ></pretty-select>
            </div>
            <div class="field-value-wrapper">
                <location-field-accuracy
                    *if="selectedValue === 'ACCURACY'"
                ></location-field-accuracy>
                <location-field-altitude
                    *if="selectedValue === 'ALTITUDE'"
                ></location-field-altitude>
                <location-field-altitude-accuracy
                    *if="selectedValue === 'ALTITUDE_ACCURACY'"
                ></location-field-altitude-accuracy>
                <location-field-distance
                    *if="selectedValue === 'BEARING'"
                    lat="{{lat}}"
                    lon="{{lon}}"
                ></location-field-distance>
                <location-field-destination
                    *if="selectedValue === 'DESTINATION'"
                    name="{{name}}"
                ></location-field-destination>
                <location-field-distance
                    *if="selectedValue === 'DISTANCE'"
                    lat="{{lat}}"
                    lon="{{lon}}"
                ></location-field-distance>
                <location-field-heading
                    *if="selectedValue === 'HEADING'"
                ></location-field-heading>
                <location-field-heading-smoothed
                    *if="selectedValue === 'HEADING_SMOOTHED'"
                ></location-field-heading-smoothed>
                <location-field-speed
                    *if="selectedValue === 'SPEED'"
                ></location-field-speed>
                <location-field-speed-smoothed
                    *if="selectedValue === 'SPEED_SMOOTHED'"
                ></location-field-speed-smoothed>
                <location-field-time
                    *if="selectedValue === 'TIME'"
                ></location-field-time>
                <location-field-time-arrival
                    *if="selectedValue === 'TIME_ARRIVAL'"
                    lat="{{lat}}"
                    lon="{{lon}}"
                    .start-position="{{startPosition}}"
                    start-time="{{startTime}}"
                ></location-field-time-arrival>
                <location-field-time-elapsed
                    *if="selectedValue === 'TIME_ELAPSED'"
                    start-time="{{startTime}}"
                ></location-field-time-elapsed>
                <location-field-time-moving
                    *if="selectedValue === 'TIME_MOVING'"
                ></location-field-time-moving>
                <location-field-time-remaining
                    *if="selectedValue === 'TIME_REMAINING'"
                    lat="{{lat}}"
                    lon="{{lon}}"
                    start-time="{{startTime}}"
                ></location-field-time-remaining>
                <location-field-time-stopped
                    *if="selectedValue === 'TIME_STOPPED'"
                ></location-field-time-stopped>
            </div>
        </div>
    `,
})
export class LocationFieldComponent {
    private _preferenceService = di(PreferenceService);
    private _storage?: LocalStorageInterface<string>;
    allowedFields: string[] = [];
    default?: string;
    startPosition?: GeolocationCoordinateResultSuccess | null = null;
    id?: string;
    lat?: string;
    lon?: string;
    name?: string;
    select?: HTMLSelectElement;
    selectedValue = '';
    startTime?: string;

    onInit() {
        const allowedFields = [
            'ACCURACY',
            'ALTITUDE',
            'ALTITUDE_ACCURACY',
            'HEADING',
            'HEADING_SMOOTHED',
            'SPEED',
            'SPEED_SMOOTHED',
            'TIME',
            'TIME_MOVING',
            'TIME_STOPPED',
        ];

        if (typeof this.lat === 'string' && typeof this.lon === 'string') {
            allowedFields.push(
                'BEARING',
                'DESTINATION',
                'DISTANCE',
                'TIME_ARRIVAL',
                'TIME_ELAPSED',
                'TIME_REMAINING'
            );
        }

        this._storage = this._preferenceService.field(
            this.id || '',
            allowedFields
        );
        this.allowedFields = allowedFields;
        this.selectedValue =
            this._storage.getItem() || this.default || 'UNKNOWN';
    }

    selectValue(value: string) {
        this.selectedValue = value;
        this._storage!.setItem(value);
    }
}
