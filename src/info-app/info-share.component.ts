import { Component, css, di, emit, html } from 'fudgel';
import { QrService } from '../services/qr.service';
import { ToastService } from '../services/toast.service';

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
            <pretty-button @click="openQrCode()" padding="0px">
                <mini-qr content="{{website}}"></mini-qr>
            </pretty-button>
            <pretty-labeled-button
                *if="allowCopy"
                @click="copyToClipboard()"
                id="info.share.copy"
                class="copyButton"
            ></pretty-labeled-button>
        </div>
    `,
})
export class InfoShareComponent {
    _qrService = di(QrService);
    _toastService = di(ToastService);
    allowCopy = false;
    website = __WEBSITE__;

    onInit() {
        this.allowCopy = !!navigator.clipboard;
    }

    copyToClipboard() {
        navigator.clipboard.writeText(__WEBSITE__);
        this._toastService.popI18n('info.share.copied');
    }

    openQrCode() {
        emit(this, 'qr');
    }
}
