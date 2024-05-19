import { Component, css, html } from 'fudgel';

@Component('info-header', {
    attr: ['id'],
    style: css`
    `,
    template: html`
        <p><i18n-label id="{{id}}"></i18n-label></p>
    `,
})
export class InfoHeaderComponent {}
