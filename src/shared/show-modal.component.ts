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
            width: 90%;
            height: 90%;
            display: flex;
            justify-content: center;
            align-items: center;
            flex-direction: column;
        }
    `,
    template: html`
        <div class="outer" @click.stop.prevent="clickOutside()">
            <div class="inner">
                <slot @click.stop="ignore"></slot>
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
