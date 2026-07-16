import { component, css, html } from 'fudgel';

export class PrettyLabeledButtonComponent {}

component('pretty-labeled-button', {
    attr: ['id'],
    style: css``,
    template: html`
        <pretty-button>
            <i18n-label id="{{id}}"></i18n-label>
        </pretty-button>
    `,
}, PrettyLabeledButtonComponent);
