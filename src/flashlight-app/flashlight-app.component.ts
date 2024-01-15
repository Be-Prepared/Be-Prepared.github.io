import { AvailabilityState } from '../datatypes/availability-state';
import { Component, css, di, html } from 'fudgel';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TorchService } from '../services/torch.service';
import { WakeLockService } from '../services/wake-lock.service';

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
                class="toggle {{this.buttonClass}}"
                @click.stop.prevent="this.toggle()"
            >
                <scaling-icon href="flashlight.svg"></scaling-icon>
            </button>
            <back-button></back-button>
        </div>
    `,
})
export class FlashlightAppComponent {
    #subject = new Subject();
    #torchService = di(TorchService);
    #wakeLockService = di(WakeLockService);
    buttonClass = '';
    enabled = false;
    explainAsk = false;
    explainDeny = false;
    explainUnavailable = false;
    showControls = false;

    onInit() {
        this.#torchService
            .availabilityState()
            .pipe(takeUntil(this.#subject))
            .subscribe((value) => {
                this.explainAsk = value === AvailabilityState.PROMPT;
                this.explainDeny = value === AvailabilityState.DENIED;
                this.explainUnavailable = value === AvailabilityState.UNAVAILABLE;
                this.showControls = value === AvailabilityState.ALLOWED;

                if (this.showControls) {
                    this.#getCurrentStatus();
                } else {
                    this.#wakeLockService.release();
                }
            });
    }

    onDestroy() {
        this.#subject.next(null);
        this.#subject.complete();
        this.#wakeLockService.release();
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

        this.#setEnabled(!this.enabled);
    }

    #getCurrentStatus() {
        this.#wakeLockService.request();
        this.#torchService.currentStatus().then((enabled) => {
            this.#setEnabled(enabled);
        });
    }

    #setEnabled(enabled: boolean) {
        this.enabled = enabled;
        this.buttonClass = enabled ? 'enabled' : '';
    }
}
