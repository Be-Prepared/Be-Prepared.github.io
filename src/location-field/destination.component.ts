import { component, css, html } from 'fudgel';

export class LocationFieldDestinationComponent {}

component('location-field-destination', {
    attr: ['name'],
    style: css`
        .no-overflow {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    `,
    template: html`<div class="no-overflow">{{name}}</div>`,
}, LocationFieldDestinationComponent);
