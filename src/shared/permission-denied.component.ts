import { Component, css, emit, html } from 'fudgel';
import { goBack } from '../util/go-back';

@Component('permission-denied', {
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
            <i18n-label id="shared.permissionDenied.heading"></i18n-label>
        </div>
        <div class="message">
            <i18n-label id="shared.permissionDenied.message"></i18n-label>
        </div>
        <div>
            <styled-link target="_blank" href="https://be-prepared.github.io"
                >https://be-prepared.github.io/</styled-link
            >
        </div>
        <back-button></back-button>
        <div></div>
    `,
})
export class PermissionDeniedComponent {
    messageId: string = '';

    goBack() {
        goBack();
    }

    grant() {
        emit(this, 'grant');
    }
}
