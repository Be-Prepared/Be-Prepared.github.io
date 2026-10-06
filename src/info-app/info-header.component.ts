import { component, css, html } from 'fudgel';

export class InfoHeaderComponent {}

component('info-header', {
    attr: ['id'],
    style: css`
        p {
            margin: 1.5em 0 0.5em;
            font-size: 0.8em;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: var(--fg-muted);
        }

        :host(:first-child) p {
            margin-top: 0;
        }
    `,
    template: html` <p><i18n-label id="{{id}}"></i18n-label></p> `,
}, InfoHeaderComponent);
