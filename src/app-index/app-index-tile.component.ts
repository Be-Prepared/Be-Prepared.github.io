import { Component, css, html } from 'fudgel';

@Component('app-index-tile', {
    attr: ['icon', 'id', 'label'],
    style: css`
        :host {
            display: flex;
            width: 100%;
            padding: 1vw;
        }

        .wrapperOuter {
            align-items: center;
            aspect-ratio: 1/1;
            display: flex;
            justify-content: center;
            box-sizing: border-box;
        }

        .wrapperInner {
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .label {
            padding-top: 0.5em;
        }

        @media (max-width: 960px) {
            :host {
                font-size: 0.8em;
            }
        }

        @media (max-width: 480px) {
            :host {
                font-size: 0.8em;
            }
        }
    `,
    template: html`
        <pretty-button @click.stop.prevent="setActiveTool()">
            <div class="wrapperOuter">
                <div class="wrapperInner">
                    <scaling-icon href="{{icon}}"></scaling-icon>
                    <div class="label">
                        <i18n-label id="{{label}}"></i18n-label>
                    </div>
                </div>
            </div>
        </pretty-button>
    `,
})
export class AppIndexTileComponent {
    icon?: string;
    id?: string;
    label?: string;

    onInit() {
        history.replaceState({}, document.title, '/');
    }

    setActiveTool() {
        history.pushState({}, document.title, `/${this.id}`);
    }
}
