import { Component, css, html } from 'fudgel';

@Component('camera-unavailable', {
    style: css`
        .wrapper {
            height: 100%;
            width: 100%;
            display: flex;
            flex-direction: column;
            justify-content: space-evenly;
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
        <default-layout>
            <div class="wrapper">
                <div class="heading">
                    <i18n-label
                        id="shared.cameraUnavailable.heading"
                    ></i18n-label>
                </div>
                <div class="message">
                    <i18n-label
                        id="shared.cameraUnavailable.message"
                    ></i18n-label>
                </div>
            </div>
        </default-layout>
    `,
})
export class CameraUnavailableComponent {}
