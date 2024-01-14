import { Attr, Component, css, di, html } from 'fudgel';

@Component('app-index-tile', {
    style: css`
        :host {
            display: flex;
            width: 100%;
            padding: 1vw;
        }

        button {
            align-items: center;
            aspect-ratio: 1/1;
            background-color: var(--button-bg-color);
            border: var(--button-border);
            border-radius: 16px;
            box-sizing: border-box;
            color: inherit;
            cursor: pointer;
            display: flex;
            justify-content: center;
            overflow: none;
            padding: 8px;
            user-select: none;
        }

        .wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
    `,
    template: html`
        <button @click.stop.prevent="this.setActiveTool()">
            <div class="wrapper">
                <scaling-icon href="{{this.icon}}"></scaling-icon>
                <div><i18n-label id="{{this.labelI18n}}"></i18n-label></div>
            </div>
        </button>
    `,
})
export class AppIndexTileComponent {
    @Attr() icon?: string;
    @Attr() id?: string;
    @Attr() label?: string;

    setActiveTool() {
        history.pushState({}, document.title, `/${this.id}`);
    }
}
