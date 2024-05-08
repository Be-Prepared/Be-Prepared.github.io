import { Component, css, di, html } from 'fudgel';
import { I18nService } from '../i18n/i18n.service';
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
                <div class="field-label">
                    <changeable-setting
                        >{{selectedField.heading}}</changeable-setting
                    >
                    <select
                        id="{{id}}"
                        #ref="select"
                        class="hidden-select"
                        @change="selectField($event.target.value)"
                    >
                        <option
                            *for="field of allowedFields"
                            value="{{field.id}}"
                        >
                            {{field.label}}
                        </option>
                    </select>
                </div>
            </div>
            <div class="field-value-wrapper">
                <location-field-accuracy
                    *if="selectedField.id === 'ACCURACY'"
                ></location-field-accuracy>
                <location-field-altitude
                    *if="selectedField.id === 'ALTITUDE'"
                ></location-field-altitude>
                <location-field-altitude-accuracy
                    *if="selectedField.id === 'ALTITUDE_ACCURACY'"
                ></location-field-altitude-accuracy>
                <location-field-distance
                    *if="selectedField.id === 'BEARING'"
                    lat="{{lat}}"
                    lon="{{lon}}"
                ></location-field-distance>
                <location-field-destination
                    *if="selectedField.id === 'DESTINATION'"
                    name="{{name}}"
                ></location-field-destination>
                <location-field-distance
                    *if="selectedField.id === 'DISTANCE'"
                    lat="{{lat}}"
                    lon="{{lon}}"
                ></location-field-distance>
                <location-field-heading
                    *if="selectedField.id === 'HEADING'"
                ></location-field-heading>
                <location-field-speed
                    *if="selectedField.id === 'SPEED'"
                ></location-field-speed>
            </div>
        </div>
    `,
})
export class LocationFieldComponent {
    private _i18nService = di(I18nService);
    private _preferenceService = di(PreferenceService);
    private _storage?: LocalStorageInterface<string>;
    allowedFields: FieldInfo[] = [];
    default?: string;
    id?: string;
    lat?: string;
    lon?: string;
    name?: string;
    select?: HTMLSelectElement;
    selectedField?: FieldInfo;

    onInit() {
        const allowedFieldTypes = [
            'ACCURACY',
            'ALTITUDE',
            'ALTITUDE_ACCURACY',
            'BEARING',
            'HEADING',
            'SPEED',
        ];

        if (typeof this.lat === 'string' && typeof this.lon === 'string') {
            allowedFieldTypes.push('DESTINATION', 'DISTANCE');
        }

        this._storage = this._preferenceService.field(this.id || '', allowedFieldTypes);

        for (const id of allowedFieldTypes) {
            this.allowedFields.push({
                heading: this._i18nService.get(`location.field.${id}.heading`),
                id,
                label: this._i18nService.get(`location.field.${id}.label`),
            });
        }

        this.allowedFields.sort((a, b) => a.label.localeCompare(b.label));

        if (!this.id) {
            return;
        }

        const selectedFieldId = this._storage.getItem();
        this.selectedField =
            this._findFieldById(selectedFieldId || '') ||
            this._findFieldById(this.default || '') ||
            this.allowedFields[0];
    }

    onViewInit() {
        if (this.select && this.selectedField) {
            this.select.value = this.selectedField.id;
        }
    }

    selectField(id: string) {
        const field = this._findFieldById(id);

        if (field) {
            this.selectedField = field;
            this._storage!.setItem(id);
        }
    }

    private _findFieldById(id: string) {
        return this.allowedFields.find((item) => item.id === id);
    }
}
