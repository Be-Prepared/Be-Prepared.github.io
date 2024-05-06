import { Component, css, html } from 'fudgel';

@Component('info-qr-app', {
    style: css``,
    template: html`
        <big-qr @click.stop.prevent="goBack()" content="{{website}}"></big-qr>
    `,
})
export class InfoQrAppComponent {
    website = __WEBSITE__;

    goBack() {
        history.go(-1);
    }
}
