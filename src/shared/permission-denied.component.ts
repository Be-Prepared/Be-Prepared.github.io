import { Attr, Component, css, emit, html } from 'fudgel';
import { goBack } from '../util/go-back';

@Component('permission-denied', {
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

        .message {
            max-width: 90%;
        }
    `,
    template: html`
        <div></div>
        <div class="heading">
            <i18n-label id="permissionDenied.heading"></i18n-label>
        </div>
        <div class="message">
            <i18n-label id="permissionDenied.message"></i18n-label>
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
    @Attr() messageId: string = '';

    goBack() {
        goBack();
    }

    grant() {
        emit(this, 'grant');
    }
}
