import { Component, css, html } from 'fudgel';

@Component('camera-unavailable', {
    style: css`
        :host {
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: center;
        }

        .heading {
            font-size: 2em;
        }
    `,
    template: html`
        <div></div>
        <div class="heading"><i18n-label id="cameraUnavailable.heading"></i18n-label></div>
        <div><i18n-label id="cameraUnavailable.message"></i18n-label></div>
        <back-button></back-button>
        <div></div>
    `
})
export class CameraUnavailableComponent {
}
