import { Component, css, html } from 'fudgel';
import { goBack } from '../util/go-back';

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
        goBack();
    }
}
