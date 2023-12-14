import { Component, css, html } from 'fudgel';
import { di } from '../di';
import { I18nService } from '../i18n/i18n.service';

@Component('app-root', {
    style: css`
        :host {
            display: block;
            height: 100%;
            width: 100%;
            overflow: none;
        }

        @media (prefers-color-scheme: dark) {
            :host {
                background-color: black;
                color: white;
            }
        }

        .wrapper {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            padding: 0.5em;
        }
    `,
    template: html`
        <div class="wrapper">
            <app-tile>{this.i18n.Flashlight}}</app-tile>
            <app-tile>{this.i18n['Front Light']}}</app-tile>
            <app-tile>{this.i18n.Magnifier}}</app-tile>
            <app-tile>{this.i18n.Mirror}}</app-tile>
            <app-tile>{this.i18n.Compass}}</app-tile>
            <app-tile>{this.i18n.GPS}}</app-tile>
            <app-tile>{this.i18n.QR}}</app-tile>
            <app-tile>{this.i18n.NFC}}</app-tile>
            <app-tile>{this.i18n.Info}}</app-tile>
        </div>
    `
})
export class AppRootComponent {
    #i18nService = di(I18nService);
    i18n = {
        'Flashlight': '',
        'Front Light': '',
        'Magnifier': '',
        'Mirror': '',
        'Compass': '',
        'GPS': '',
        'QR': '',
        'NFC': '',
        'Info': ''
    };
    tiles: string[] = ['info'];

    onInit() {
        this.#i18nService.update(this.i18n);
    }
}
