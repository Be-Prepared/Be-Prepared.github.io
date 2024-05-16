import { Component, css, emit, html } from 'fudgel';

@Component('pretty-input', {
    attr: ['value'],
    prop: ['value'],
    style: css`
        :host {
            display: block;
        }

        input {
            font: inherit;
            width: 100%;
            text-align: center;
            color: var(--fg-color);
            background-color: var(--bg-color);
        }
    `,
    template: html`
        <input
            type="text"
            value="{{value}}"
            @change.stop.prevent="change($event.target.value)"
        />
    `,
})
export class PrettyInputComponent {
    change(value: string) {
        emit(this, 'change', value);
    }
}
