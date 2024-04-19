import { Component, css, html } from 'fudgel';

@Component('location-unavailable', {
    style: css`
        :host {
            height: 100%;
            width: 100%;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: center;
        }

        .heading {
            font-size: 2em;
        }

        .message {
            max-width: 90%;
        }
    `,
    template: html`
        <div></div>
        <div class="heading"><i18n-label id="location.unavailable"></i18n-label></div>
        <div class="message"><i18n-label id="location.unavailableMessage"></i18n-label></div>
        <back-button></back-button>
        <div></div>
    `
})
export class LocationUnavailableComponent {
}
