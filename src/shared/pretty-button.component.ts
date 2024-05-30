import { Component, css, html } from 'fudgel';

@Component('pretty-button', {
    attr: ['padding'],
    prop: ['enabled'],
    style: css`
        :host {
            display: block;
        }

        button {
            background-color: var(--button-bg-color);
            border: 2px solid var(--fg-color);
            border-radius: 1em;
            color: inherit;
            font-size: inherit;
            overflow: hidden;
            cursor: pointer;
            overflow: none;
            user-select: none;
        }

        .enabled {
            background-color: var(--button-bg-color-enabled);
        }
    `,
    template: html`
        <button class="{{enabled && 'enabled'}}" #ref="button">
            <slot></slot>
        </button>
    `,
    useShadow: true,
})
export class PrettyButtonComponent {
    button?: HTMLButtonElement;
    padding = '0.5em';

    onViewInit() {
        if (this.button) {
            this.button.style.padding = this.padding || '0.5em';
        }
    }
}
