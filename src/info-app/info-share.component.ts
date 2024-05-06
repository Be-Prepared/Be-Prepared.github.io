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
            justify-content: space-around;
        }

        .copyButton {
            padding: 0 1em;
        }

        .qrButton {
            padding: 0;
        }
    `,
    template: html`
        <div class="website">
            {{website}}
        </div>
        <div class="buttons">
            <button *if="allowCopy" @click="copyToClipboard()" class="copyButton">
                <i18n-label *if="!showCopied" id="info.share.copy"></i18n-label>
                <i18n-label *if="showCopied" id="info.share.copied"></i18n-label>
            </button>
            <button @click="openQrCode()" class="qrButton">
                <mini-qr content="{{website}}"></mini-qr>
            </button>
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
