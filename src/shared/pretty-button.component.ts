import { Component, css, html } from 'fudgel';

@Component('pretty-button', {
    attr: ['id'],
    style: css`
        :host {
            display: block;
        }

        button {
            background-color: var(--button-bg-color);
            border: 2px solid var(--fg-color);
            border-radius: 15px;
            padding: 7.5px;
            color: inherit;
            font-size: inherit;
        }
    `,
    template: html`
        <button>
            <i18n-label id="{{id}}"></i18n-label>
        </button>
    `,
})
export class PrettyButtonComponent {}
