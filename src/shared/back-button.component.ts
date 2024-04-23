import { Component, css, emit, html } from 'fudgel';
import { goBack } from '../util/go-back';

@Component('back-button', {
    attr: ['emit'],
    style: css`
        .back {
            padding: 5px;
        }
    `,
    template: html`
        <scaling-icon
            class="back"
            @click.stop.prevent="back()"
            href="./back.svg"
        ></scaling-icon>
    `
})
export class BackButtonComponent {
    emit?: string;

    back() {
        if (this.emit) {
            emit(this, this.emit);
        } else {
            goBack();
        }
    }
}
