import { Attr, Component, css, di, html } from 'fudgel';
import { I18nService } from '../i18n/i18n.service';

@Component('app-tile', {
    style: css`
        :host {
            display: flex;
            width: 100%;
        }

        .button {
            align-items: center;
            aspect-ratio: 1/1;
            background-color: #7f7f7f27;
            border: 4px solid gray;
            border-radius: 16px;
            box-sizing: border-box;
            cursor: pointer;
            display: flex;
            justify-content: center;
            overflow: none;
            padding: 8px;
            user-select: none;
            width: 100%;
        }

        .button.enabled {
            background-color: #7fff7f30;
        }

        .button.disabled {
            display: none;
        }

        .wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .icon {
            height: 5em;
            width: 5em;
        }
    `,
    template: html`
        <a class="button">
            <grow-to-fit @click="this.setActiveTool()">
                <div class="wrapper">
                    <load-svg class="icon" href="{{this.icon}}"></load-svg>
                    <div>{{this.labelI18n}}</div>
                </div>
            </grow-to-fit>
        </a>
    `,
})
export class AppTileComponent {
    #i18nService: I18nService = di(I18nService);
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
