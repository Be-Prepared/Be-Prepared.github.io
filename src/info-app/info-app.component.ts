import { Component, css, html } from 'fudgel';

@Component('info-app', {
    style: css`
        :host {
            display: flex;
            flex-direction: column;
            font-size: 1.2em;
            height: 100%;
            width: 100%;
            box-sizing: border-box;
        }

        .wrapper {
            padding: 1em;
            height: 100%;
            width: 100%;
            overflow: hidden;
            display: flex;
            box-sizing: border-box;
        }

        .wrapperInner {
            flex-grow: 1;
            padding: 0.3em;
            border-style: solid;
            box-sizing: border-box;
            border-width: 1px;
            overflow-x: auto;
            height: 100%;
            width: 100%;
        }

        .buttons {
            display: flex;
        }

        @media (orientation: landscape) {
            :host {
                flex-direction: row-reverse;
            }

            .buttons {
                flex-direction: column-reverse;
            }
        }
    `,
    template: html`
        <div class="wrapper">
            <div class="wrapperInner">
                <info-share @qr="openQrCode()"></info-share>
                <info-permissions></info-permissions>
                <info-preferences></info-preferences>
                <info-barcodes></info-barcodes>
                <info-tooling></info-tooling>
                <info-build></info-build>
            </div>
        </div>
        <div class="buttons">
            <back-button></back-button>
        </div>
        <show-modal *if="showQr" @clickoutside="closeQrCode()">
            <big-qr @click="closeQrCode()" content="{{website}}"></big-qr>
        </show-modal>
    `,
})
export class InfoAppComponent {
    showQr = false;

    closeQrCode() {
        this.showQr = false;
    }

    openQrCode() {
        this.showQr = true;
    }
}
