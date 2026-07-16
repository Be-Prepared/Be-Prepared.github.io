import { component, css, html } from 'fudgel';
import { goBack } from '../util/go-back';

export class BackButtonComponent {
    back() {
        goBack();
    }
}

component('back-button', {
    style: css``,
    template: html`
        <scaling-icon
            @click.stop.prevent="back()"
            href="/back.svg"
        ></scaling-icon>
    `,
}, BackButtonComponent);
