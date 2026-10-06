import { component, css, html } from 'fudgel';
import { goBack } from '../util/go-back';

export class BackButtonComponent {
    back() {
        goBack();
    }
}

component(
    'back-button',
    {
        style: css``,
        template: html`
            <icon-button
                @click.stop.prevent="back()"
                href="/back.svg"
                label-id="shared.access.back"
            ></icon-button>
        `,
    },
    BackButtonComponent
);
