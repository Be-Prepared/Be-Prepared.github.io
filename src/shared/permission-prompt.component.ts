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

        button {
            background-color: var(--button-bg-color);
            border: 2px solid var(--fg-color);
            border-radius: 15px;
            font-size: 1.5em;
            padding: 7.5px;
            color: inherit;
        }
    `,
    template: html`
        <div></div>
        <div class="heading"><i18n-label id="permissionPrompt.heading"></i18n-label></div>
        <div class="message"><i18n-label id="{{messageId}}"></i18n-label></div>
        <div><button @click.stop.prevent="grant()"><i18n-label id="permissionPrompt.grantPermission"></i18n-label></div>
        <div><button @click.stop.prevent="goBack()"><i18n-label id="permissionPrompt.goBack"></i18n-label></button></div>
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
