import { Component, css, html } from 'fudgel';

@Component('back-button', {
    style: css`
        .back {
            padding: 5px;
        }
    `,
    template: html`
        <scaling-icon
            class="back"
            @click.stop.prevent="this.back()"
            href="./back.svg"
        ></scaling-icon>
    `
})
export class BackButtonComponent {
    back() {
        window.history.go(-1);
    }
}
