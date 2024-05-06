import { Component, css, html } from 'fudgel';
import { default as QrCodeSvg } from 'qrcode-svg';

const WEBSITE = 'https://be-prepared.github.io/';

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
            position: relative;
        }

        .miniSvg {
            width: 4em;
            height: 4em;
        }

        .qrOuter {
            position: absolute;
            top: 0;
            right: 0;
            bottom: 0;
            left: 0;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .qrInner {
            background-color: white;
            color: black;
            padding: 0.25em;
        }

        .svgOuter {
            position: fixed;
            top: 0;
            right: 0;
            bottom: 0;
            left: 0;
            background-color: var(--bg-color);
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .svgInner {
            width: 90vmin;
            height: 90vmin;
        }

        .svgHidden {
            display: none;
            position: relative;
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
                <div #ref="miniSvg" class="miniSvg"></div>
                <div class="qrOuter"><div class="qrInner"><i18n-label id="info.share.qr"></i18n-label></div></div>
            </button>
        </div>
        <div class="svgOuter svgHidden" #ref="svgOuter" @click.stop.prevent="closeQrCode()">
            <div class="svgInner" #ref="svgInner"></div>
        </div>
    `,
})
export class InfoShareComponent {
    allowCopy = false;
    miniSvg?: HTMLButtonElement;
    showCopied = false;
    showQR = false;
    svgInner?: HTMLDivElement;
    svgOuter?: HTMLDivElement;
    timeout?: ReturnType<typeof setTimeout>;
    website = WEBSITE;

    onInit() {
        this.allowCopy = !!navigator.clipboard;
    }

    onViewInit() {
        const svg = this._svgContent();

        if (this.miniSvg) {
            this.miniSvg.innerHTML = svg;
        }

        if (this.svgInner) {
            this.svgInner.innerHTML = svg;
        }
    }

    closeQrCode() {
        this.svgOuter?.classList.add('svgHidden');
    }

    copyToClipboard() {
        navigator.clipboard.writeText(WEBSITE);
        this.showCopied = true;

        if (this.timeout) {
            clearTimeout(this.timeout);
        }

        this.timeout = setTimeout(() => {
            this.showCopied = false;
        }, 3000);
    }

    openQrCode() {
        this.svgOuter?.classList.remove('svgHidden');
    }

    _svgContent() {
        return new QrCodeSvg({
            content: WEBSITE,
            container: 'svg-viewbox',
            join: true,
        }).svg();
    }
}
