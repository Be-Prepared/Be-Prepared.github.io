import { component, css, html } from 'fudgel';
import { goBack } from '../util/go-back';

export class BackButtonComponent {
    // The arrow points the way reading goes back, so it flips for Arabic.
    // It sits inside shadow roots, where a [dir] selector can't reach.
    className = document.documentElement.dir === 'rtl' ? 'flip' : '';

    back() {
        goBack();
    }
}

component(
    'back-button',
    {
        style: css`
            .flip {
                transform: scaleX(-1);
            }
        `,
        template: html`
            <icon-button
                class="{{className}}"
                @click.stop.prevent="back()"
                href="/back.svg"
                label-id="shared.access.back"
            ></icon-button>
        `,
    },
    BackButtonComponent
);
