import { Component, css, di, html } from 'fudgel';
import { I18nService } from '../i18n/i18n.service';

@Component('flashlight-app', {
    style: css`
        :host {
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .toggle {
            background-color: var(--button-bg-color);
            border: 2px solid var(--fg-color);
            border-radius: 30px;
            color: inherit;
            font-size: 3em;
            padding: 15px;
        }

        .enabled {
            background-color: var(--button-bg-color-enabled);
        }

        .back {
            position: absolute;
            bottom: 0;
            left: 0;
        }
    `,
    template: html`
        <button
            class="toggle {{this.buttonClass}}"
            @click.stop.prevent="this.toggle()"
        >
            {{this.labelI18n}}
        </button>
        <div class="back">
            <back-button></back-button>
        </div>
    `,
})
export class FlashlightAppComponent {
    #i18nService = di(I18nService);
    buttonClass = '';
    enabled = false;
    labelI18n?: string;

    constructor() {
        this.#updateLabel();
    }

    toggle() {
        this.enabled = !this.enabled;
        this.buttonClass = this.enabled ? 'enabled' : '';
        this.#updateLabel();
    }

    #updateLabel() {
        this.labelI18n = this.#i18nService.get(
            this.enabled ? 'flashlight.turnOff' : 'flashlight.turnOn'
        );
    }
}
