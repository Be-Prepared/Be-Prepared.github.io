import { AvailabilityState } from '../datatypes/availability-state';
import { Component, css, di, html } from 'fudgel';
import { Subscription } from 'rxjs';
import { TorchService } from '../services/torch.service';

@Component('flashlight-app', {
    style: css`
        :host,
        .wrapper {
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
        <permission-prompt
            *if="this.explainAsk"
            @grant.stop.prevent="this.grant()"
            message-id="flashlight.explainAsk"
        ></permission-prompt>
        <permission-denied *if="this.explainDeny"></permission-denied>
        <flashlight-unavailable
            *if="this.explainUnavailable"
        ></flashlight-unavailable>
        <div *if="this.showControls" class="wrapper">
            <div></div>
            <button
                *if="this.label"
                class="toggle {{this.buttonClass}}"
                @click.stop.prevent="this.toggle()"
            >
                <i18n-label id="{{this.label}}"></i18n-label>
            </button>
            <back-button></back-button>
        </div>
    `,
})
export class FlashlightAppComponent {
    #subscription: Subscription;
    #torchService = di(TorchService);
    buttonClass = '';
    enabled = false;
    explainAsk = false;
    explainDeny = false;
    explainUnavailable = false;
    label: string | null = null;
    showControls = false;

    constructor() {
        this.#subscription = this.#torchService
            .availabilityState()
            .subscribe((value) => {
                this.label = null;
                this.explainAsk = false;
                this.explainDeny = false;
                this.explainUnavailable = false;
                this.showControls = false;

                if (value === AvailabilityState.PROMPT) {
                    this.explainAsk = true;
                } else if (value === AvailabilityState.DENIED) {
                    this.explainDeny = true;
                } else if (value === AvailabilityState.UNAVAILABLE) {
                    this.explainUnavailable = true;
                } else {
                    this.showControls = true;
                    this.#updateLabel();
                }
            });
    }

    onDestroy() {
        this.#subscription.unsubscribe();
    }

    grant() {
        this.#torchService.currentStatus();
    }

    toggle() {
        if (this.enabled) {
            this.#torchService.turnOff();
        } else {
            this.#torchService.turnOn();
        }

        this.enabled = !this.enabled;
        this.buttonClass = this.enabled ? 'enabled' : '';
        this.#updateLabel();
    }

    #updateLabel() {
        this.#torchService.currentStatus().then((enabled) => {
            this.label = enabled ? 'flashlight.turnOff' : 'flashlight.turnOn';
            this.enabled = enabled;
        });
    }
}
