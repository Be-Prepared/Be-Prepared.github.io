import { Component, css, emit, html } from 'fudgel';
import { goBack } from '../util/go-back';

@Component('permission-prompt', {
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

        .bigger {
            font-size: 1.5em;
        }
    `,
    template: html`
        <div></div>
        <div class="heading">
            <i18n-label id="shared.permissionPrompt.heading"></i18n-label>
        </div>
        <div class="message"><i18n-label id="{{messageId}}"></i18n-label></div>
        <div class="bigger">
            <pretty-labeled-button
                @click.stop.prevent="grant()"
                id="shared.permissionPrompt.grantPermission"
            ></pretty-labeled-button>
        </div>
        <div class="bigger">
            <pretty-labeled-button
                @click.stop.prevent="goBack()"
                id="shared.permissionPrompt.goBack"
            ></pretty-labeled-button>
        </div>
        <div></div>
    `,
})
export class PermissionPromptComponent {
    messageId: string = '';

    goBack() {
        goBack();
    }

    grant() {
        emit(this, 'grant');
    }
}
