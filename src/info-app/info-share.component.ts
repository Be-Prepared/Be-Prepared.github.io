import { Component, css, di, html } from 'fudgel';
import { QrService } from '../services/qr.service';

@Component('info-share', {
    style: css`
        :host {
            position: relative;
        }

        .website {
            text-align: center;
            margin-bottom: 1em;
        }

        .buttons {
            display: flex;
            justify-content: space-evenly;
            align-items: center;
        }

        .copyButton {
            padding: 0 1em;
        }

        button {
            background-color: var(--button-bg-color);
            border: 2px solid var(--fg-color);
            border-radius: 15px;
            padding: 7.5px;
            color: inherit;
            font-size: inherit;
            overflow: hidden;
        }
    `,
    template: html`
        <div class="website">{{website}}</div>
        <div class="buttons">
            <pretty-labeled-button
                *if="allowCopy && !showCopied"
                @click="copyToClipboard()"
                id="info.share.copy"
                class="copyButton"
            ></pretty-labeled-button>
            <div *if="showCopied">
                <i18n-label id="info.share.copied"></i18n-label>
            </div>
            <pretty-button @click="openQrCode()" padding="0px">
                <mini-qr content="{{website}}"></mini-qr>
            </pretty-button>
        </div>
    `,
})
export class InfoShareComponent {
    _qrService = di(QrService);
    allowCopy = false;
    showCopied = false;
    timeout?: ReturnType<typeof setTimeout>;
    website = __WEBSITE__;

    onInit() {
        this.allowCopy = !!navigator.clipboard;
    }

    copyToClipboard() {
        navigator.clipboard.writeText(__WEBSITE__);
        this.showCopied = true;

        if (this.timeout) {
            clearTimeout(this.timeout);
        }

        this.timeout = setTimeout(() => {
            this.showCopied = false;
        }, 3000);
    }

    openQrCode() {
        history.pushState({}, document.title, '/info-qr');
    }
}
