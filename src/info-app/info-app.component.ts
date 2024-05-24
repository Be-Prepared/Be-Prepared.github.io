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
        <default-layout frame>
            <info-share @qr="openQrCode()"></info-share>
            <info-permissions></info-permissions>
            <info-preferences></info-preferences>
            <info-barcodes></info-barcodes>
            <info-tooling></info-tooling>
            <info-build></info-build>
        </default-layout>
        <show-modal *if="showQr" @clickoutside="closeQrCode()">
            <big-qr @click="closeQrCode()" content="{{website}}"></big-qr>
        </show-modal>
    `,
})
export class InfoAppComponent {
    showQr = false;
    website = __WEBSITE__;

    closeQrCode() {
        this.showQr = false;
    }

    openQrCode() {
        this.showQr = true;
    }
}
