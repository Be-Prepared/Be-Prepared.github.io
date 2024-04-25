import { AvailabilityState } from '../datatypes/availability-state';
import { Component, css, di, html } from 'fudgel';
import { PermissionsService } from '../services/permissions.service';
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
            width: 100%;
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

        .buttonBar {
            width: 100%;
            display: flex;
            justify-content: space-between;
        }
    `,
    template: html`
        <permission-prompt
            *if="explainAsk"
            @grant.stop.prevent="grant()"
            message-id="flashlight.explainAsk"
        ></permission-prompt>
        <permission-denied *if="explainDeny"></permission-denied>
        <flashlight-unavailable
            *if="explainUnavailable"
        ></flashlight-unavailable>
        <div *if="showControls" class="wrapper">
            <div></div>
            <button
                class="toggle {{buttonClass}}"
                @click.stop.prevent="toggle()"
            >
                <scaling-icon href="/flashlight.svg"></scaling-icon>
            </button>
            <div class="buttonBar">
                <back-button></back-button>
            </div>
        </div>
    `,
})
export class FlashlightAppComponent {
    #permissionsService = di(PermissionsService);
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
            .availabilityState(true)
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
        this.#permissionsService.camera(true);
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
