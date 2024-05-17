import { Component, css, html } from 'fudgel';
import { goBack } from '../util/go-back';

@Component('permission-error', {
    attr: ['messageId'],
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
        <div class="heading">
            <i18n-label id="shared.permissionError.heading"></i18n-label>
        </div>
        <div class="message">
            <i18n-label id="shared.permissionError.message"></i18n-label>
        </div>
        <back-button></back-button>
        <div></div>
    `,
})
export class PermissionErrorComponent {
    messageId: string = '';

    goBack() {
        goBack();
    }
}
