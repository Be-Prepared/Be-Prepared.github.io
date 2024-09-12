import { Component, css, emit, html } from 'fudgel';
import { di } from '../di';
import { I18nService } from '../i18n/i18n.service';

@Component('pretty-select', {
    attr: ['i18nBase', 'default', 'value'],
    prop: ['options'],
    style: css`
        :host {
            display: inline-block;
            position: relative;
        }

        select {
            position: absolute;
            inset: 0;
            opacity: 0;
            font-size: inherit;
            cursor: pointer;
        }
    `,
    template: html`
        <changeable-setting>{{label}} ▿</changeable-setting>
        <select
            #ref="select"
            @change.stop.prevent="selectValue($event.target.value)"
            value="{{value}}"
        >
            <option *for="option of sorted" value="{{option.value}}">
                {{option.label}}
            </option>
        </select>
    `,
})
export class PrettySelectComponent {
    private _i18nService = di(I18nService);
    default: string = '';
    i18nBase: string = '';
    label = '';
    options: [] = [];
    select?: HTMLSelectElement;
    sorted: { value: string; label: string }[] = [];
    value: string = '';

    onInit() {
        this.sorted = this.options
            .map((value: string) => ({
                value,
                label: this._labelForValue(value),
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
        this._confirmValue();
        this.label = this._labelForValue(this.value);
    }

    onViewInit() {
        if (this.select) {
            this.select.value = this.value;
        }
    }

    selectValue(value: string) {
        if (this._findOption(value)) {
            this.value = value;
            this.label = this._labelForValue(this.value);

            if (this.select) {
                this.select.value = value;
            }

            emit(this, 'change', value);
        }
    }

    _confirmValue() {
        const option = this._findOption(this.value);
        let newValue = this.value;

        if (!option) {
            newValue = this.default;
            const defaulted = this._findOption(newValue);

            if (!defaulted) {
                newValue = this.sorted[0]
                    ? this.sorted[0].value
                    : 'UNKNOWN_VALUE';
            }
        }

        if (this.value !== newValue) {
            this.selectValue(newValue);
        }
    }

    _findOption(value: string) {
        return this.sorted.find((option) => option.value === value);
    }

    _labelForValue(value: string) {
        return this._i18nService.get(`${this.i18nBase}.${value}`);
    }
}
