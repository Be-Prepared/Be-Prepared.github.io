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
    private _permissionsService = di(PermissionsService);
    private _subject = new Subject();
    private _torchService = di(TorchService);
    private _wakeLockService = di(WakeLockService);
    buttonClass = '';
    enabled = false;
    explainAsk = false;
    explainDeny = false;
    explainUnavailable = false;
    showControls = false;

    onInit() {
        this._torchService
            .availabilityState(true)
            .pipe(takeUntil(this._subject))
            .subscribe((value) => {
                this.explainAsk = value === AvailabilityState.PROMPT;
                this.explainDeny = value === AvailabilityState.DENIED;
                this.explainUnavailable =
                    value === AvailabilityState.UNAVAILABLE;
                this.showControls = value === AvailabilityState.ALLOWED;

                if (this.showControls) {
                    this._getCurrentStatus();
                } else {
                    this._wakeLockService.release();
                }
            });
    }

    onDestroy() {
        this._subject.next(null);
        this._subject.complete();
        this._wakeLockService.release();
    }

    grant() {
        this._permissionsService.camera(true);
    }

    toggle() {
        if (this.enabled) {
            this._torchService.turnOff();
        } else {
            this._torchService.turnOn();
        }

        this._setEnabled(!this.enabled);
    }

    private _getCurrentStatus() {
        this._wakeLockService.request();
        this._torchService.currentStatus().then((enabled) => {
            this._setEnabled(enabled);
        });
    }

    private _setEnabled(enabled: boolean) {
        this.enabled = enabled;
        this.buttonClass = enabled ? 'enabled' : '';
    }
}
