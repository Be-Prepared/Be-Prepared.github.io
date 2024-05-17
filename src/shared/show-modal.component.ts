import { Component, css, emit, html } from 'fudgel';

@Component('show-modal', {
    style: css`
        .outer {
            display: flex;
            justify-content: center;
            align-items: center;
            position: fixed;
            inset: 0;
            background-color: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(5px);
        }

        .inner {
            max-width: 90%;
            max-height: 90%;
        }
    `,
    template: html`
        <div class="outer" @click.stop.prevent="clickOutside()">
            <div class="inner" @click.stop="ignore()">
                <slot></slot>
            </div>
        </div>
    `,
    useShadow: true,
})
export class ShowModalComponent {
    clickOutside() {
        emit(this, 'clickoutside');
    }

    ignore() {}
}
