import { Component, css, html } from 'fudgel';

@Component('pretty-labeled-button', {
    attr: ['id'],
    style: css``,
    template: html`
        <pretty-button>
            <i18n-label id="{{id}}"></i18n-label>
        </pretty-button>
    `,
})
export class PrettyLabeledButtonComponent {}
