import { Component, css, html } from 'fudgel';

@Component('location-add-edit', {
    attr: ['id'],
    style: css`
    `,
    template: html`
    Add/edit {{id}}
    `
})
export class LocationAddEditComponent {
    id?: string;
}
