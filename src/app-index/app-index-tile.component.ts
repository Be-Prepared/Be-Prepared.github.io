import { Attr, Component, css, di, html } from 'fudgel';
import { I18nService } from '../i18n/i18n.service';

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
                <div>{{this.labelI18n}}</div>
            </div>
        </button>
    `,
})
export class AppIndexTileComponent {
    #i18nService = di(I18nService);
    @Attr() icon?: string;
    @Attr() id?: string;
    @Attr() label?: string;
    labelI18n?: string;

    onChange() {
        this.labelI18n = this.#i18nService.get(this.label || '');
    }

    setActiveTool() {
        history.pushState({}, document.title, `/${this.id}`);
    }
}
