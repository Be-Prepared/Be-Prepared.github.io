import { Component, css, html } from 'fudgel';

@Component('app-index-tile', {
    attr: ['icon', 'id', 'label'],
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
                <div><i18n-label id="{{this.label}}"></i18n-label></div>
            </div>
        </button>
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
