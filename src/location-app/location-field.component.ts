import { Component, css, di, html } from 'fudgel';
import { LocalStorageInterface } from '../services/local-storage.service';
import { PreferenceService } from '../services/preference.service';

interface FieldInfo {
    heading: string;
    id: string;
    label: string;
}

@Component('location-field', {
    attr: ['default', 'id', 'lat', 'lon', 'name'],
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
                <location-field-speed
                    *if="selectedValue === 'SPEED'"
                ></location-field-speed>
            </div>
        </div>
    `,
})
export class LocationFieldComponent {
    private _preferenceService = di(PreferenceService);
    private _storage?: LocalStorageInterface<string>;
    allowedFields: string[] = [];
    default?: string;
    id?: string;
    lat?: string;
    lon?: string;
    name?: string;
    select?: HTMLSelectElement;
    selectedValue = '';

    onInit() {
        const allowedFields = [
            'ACCURACY',
            'ALTITUDE',
            'ALTITUDE_ACCURACY',
            'HEADING',
            'SPEED',
        ];

        if (typeof this.lat === 'string' && typeof this.lon === 'string') {
            allowedFields.push('BEARING', 'DESTINATION', 'DISTANCE');
        }

        this._storage = this._preferenceService.field(
            this.id || '',
            allowedFields
        );
        this.allowedFields = allowedFields;
        this.selectedValue = this._storage.getItem() || this.default || 'UNKNOWN';
    }

    selectValue(value: string) {
        this.selectedValue = value;
        this._storage!.setItem(value);
    }
}
