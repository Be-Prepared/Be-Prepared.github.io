import { Component, css, di, html } from 'fudgel';
import { I18nService } from '../i18n/i18n.service';

interface FieldInfo {
    id: string;
    label: string;
}

@Component('location-field', {
    attr: ['default', 'id', 'lat', 'lon', 'name'],
    style: css`
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
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            opacity: 0;
            font-size: inherit;
            cursor: pointer;
        }
    `,
    template: html`
        <div class="field-line">
            <div class="field-label-wrapper">
                <div class="field-label">
                    {{selectedField.label}}
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
    #i18nService = di(I18nService);
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
            'HEADING',
            'SPEED',
        ];

        if (this.lat !== undefined && this.lon !== undefined) {
            allowedFieldTypes.push('DESTINATION', 'DISTANCE');
        }

        for (const id of allowedFieldTypes) {
            this.allowedFields.push({
                id,
                label: this.#i18nService.get(`location.field.${id}`),
            });
        }

        this.allowedFields.sort((a, b) => a.label.localeCompare(b.label));

        if (!this.id) {
            return;
        }

        const selectedFieldId = localStorage.getItem(`field.${this.id}`) || '';
        this.selectedField =
            this.#findFieldById(selectedFieldId) ||
            this.#findFieldById(this.default || '') ||
            this.allowedFields[0];
    }

    onViewInit() {
        if (this.select && this.selectedField) {
            this.select.value = this.selectedField.id;
        }
    }

    selectField(id: string) {
        const field = this.#findFieldById(id);

        if (field) {
            this.selectedField = field;
            localStorage.setItem(`field.${this.id}`, id);
        }
    }

    #findFieldById(id: string) {
        return this.allowedFields.find((item) => item.id === id);
    }
}
