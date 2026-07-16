import { component, css, html } from 'fudgel';

export class InfoHeaderComponent {}

component('info-header', {
    attr: ['id'],
    style: css``,
    template: html` <p><i18n-label id="{{id}}"></i18n-label></p> `,
}, InfoHeaderComponent);
