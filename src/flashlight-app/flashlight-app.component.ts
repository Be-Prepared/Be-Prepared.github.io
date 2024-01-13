import { Component, css, di, html } from 'fudgel';
import { goBack } from '../util/go-back';
import { I18nService } from '../i18n/i18n.service';
import { PermissionsService, PermissionsServiceState } from '../services/permissions.service';
import { Subscription } from 'rxjs';
import { TorchService } from '../services/torch.service';

@Component('flashlight-app', {
    style: css`
        :host {
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
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
    `,
    template: html`
        <div></div>
        <p *if="this.explainAsk">{{this.explainAskText}}</p>
        <button
            *if="!this.explainDeny"
            class="toggle {{this.buttonClass}}"
            @click.stop.prevent="this.toggle()"
        >
            {{this.labelI18n}}
        </button>
        <p *if="this.explainDeny">{{this.explainDenyText}}</p>
        <info-app-permission *if="this.explainDeny" name="{{this.currentPermissionStatus}}" permission="torch"></info-app-permission>
        <back-button></back-button>
    `,
})
export class FlashlightAppComponent {
    #i18nService = di(I18nService);
    #permissionsService = di(PermissionsService);
    #subscription: Subscription;
    #torchService = di(TorchService);
    buttonClass = '';
    currentPermissionStatus: string;
    enabled = false;
    explainAsk = false;
    explainAskText: string;
    explainDeny = false;
    explainDenyText: string;
    labelI18n?: string;

    constructor() {
        this.currentPermissionStatus = this.#i18nService.get('app.currentPermissionStatus');
        this.explainAskText = this.#i18nService.get('flashlight.explainAsk');
        this.explainDenyText = this.#i18nService.get('flashlight.explainDeny');
        this.#updateLabel();
        this.#subscription = this.#permissionsService
            .torch()
            .subscribe((value) => {
                if (value === PermissionsServiceState.PROMPT) {
                    this.explainDeny = false;
                    this.explainAsk = true;
                } else if (value === PermissionsServiceState.GRANTED) {
                    this.explainDeny = false;
                    this.explainAsk = false;
                } else {
                    this.explainDeny = true;
                    this.explainAsk = false;
                }
            });
    }

    onDestroy() {
        if (this.#subscription) {
            this.#subscription.unsubscribe();
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        this.buttonClass = this.enabled ? 'enabled' : '';
        this.#torchService.toggleTorch(this.enabled);
        this.#updateLabel();
    }

    #updateLabel() {
        this.labelI18n = this.#i18nService.get(
            this.enabled ? 'flashlight.turnOff' : 'flashlight.turnOn'
        );
    }
}
