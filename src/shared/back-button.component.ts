import { Component, css, html } from 'fudgel';
import { goBack } from '../util/go-back';

@Component('back-button', {
    style: css``,
    template: html`
        <scaling-icon
            @click.stop.prevent="back()"
            href="/back.svg"
        ></scaling-icon>
    `,
})
export class BackButtonComponent {
    back() {
        goBack();
    }
}
