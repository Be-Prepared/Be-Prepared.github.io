import { Component, css, di, html } from 'fudgel';
import { I18nService } from '../i18n/i18n.service';

@Component('location-help-app', {
    style: css`
        :host {
            display: flex;
            flex-direction: column;
            font-size: 1.2em;
            height: 100%;
            width: 100%;
            box-sizing: border-box;
        }

        .wrapper {
            padding: 1em;
            height: 100%;
            width: 100%;
            overflow: hidden;
            display: flex;
            box-sizing: border-box;
        }

        .wrapperInner {
            flex-grow: 1;
            padding: 0.3em;
            border-style: solid;
            box-sizing: border-box;
            border-width: 1px;
            overflow-x: auto;
            height: 100%;
            width: 100%;
        }

        .buttons {
            display: flex;
        }

        @media (orientation: landscape) {
            :host {
                flex-direction: row-reverse;
            }

            .buttons {
                flex-direction: column-reverse;
            }
        }
    `,
    template: html`
        <div class="wrapper">
            <div class="wrapperInner" #ref="container">
        </div>
        <div class="buttons">
            <back-button></back-button>
        </div>
    `,
})
export class InfoAppComponent {
    private _i18nService = di(I18nService);
    container?: HTMLElement;

    onViewInit() {
        if (this.container) {
            this.container.innerHTML = this._i18nService.get('location.help.html');
        }
    }
}
