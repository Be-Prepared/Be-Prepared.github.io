import { Attr, Component, css, html } from 'fudgel';
import { di } from '../di';
import { I18nService } from '../i18n/i18n.service';

@Component('app-tile', {
    style: css`
        :host {
            box-sizing: border-box;
            padding: 0.5em;
            display: flex;
            width: 10em;
        }

        .button {
            align-items: center;
            aspect-ratio: 1/1;
            background-color: #7f7f7f30;
            border: 4px solid gray;
            border-radius: 16px;
            box-sizing: border-box;
            cursor: pointer;
            display: flex;
            justify-content: center;
            overflow: none;
            padding: 8px;
            width: 100%;
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

        @media (max-width: 60em) {
            :host {
                width: 8em;
            }
        }

        @media (max-width: 30em) {
            :host {
                width: 33%;
            }
        }

        @media (max-width: 20em) {
            :host {
                width: 50%;
            }
        }

        @media (max-width: 10em) {
            :host {
                width: 100%;
            }
        }
    `,
    template: html`
        <div class="button">
            <grow-to-fit>
                <div class="wrapper">
                    <load-svg class="icon" href="{{this.icon}}"></load-svg>
                    <div>{{this.labelI18n}}</div>
                </div>
            </grow-to-fit>
        </div>
    `,
})
export class AppTileComponent {
    #i18nService: I18nService = di(I18nService);
    @Attr() icon?: string;
    @Attr() label?: string;
    labelI18n?: string;

    onChange() {
        this.labelI18n = this.#i18nService.get(this.label || '');
    }
}
