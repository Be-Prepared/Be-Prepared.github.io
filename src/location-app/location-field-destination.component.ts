import { Component, css, html } from 'fudgel';

@Component('location-field-destination', {
    attr: ['name'],
    style: css`
        .no-overflow {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    `,
    template: html`<div class="no-overflow">{{name}}</div>`,
})
export class LocationFieldDestinationComponent {}
