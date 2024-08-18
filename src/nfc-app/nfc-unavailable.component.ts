import { Component, css, html } from 'fudgel';

@Component('nfc-unavailable', {
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
                        id="nfc.unavailable.heading"
                    ></i18n-label>
                </div>
                <div class="message">
                    <i18n-label
                        id="nfc.unavailable.message"
                    ></i18n-label>
                </div>
            </div>
        </default-layout>
    `,
})
export class NfcUnavailableComponent {}
