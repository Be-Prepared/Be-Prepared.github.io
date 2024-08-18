import { AvailabilityState } from '../datatypes/availability-state';
import { Component, css, di, html } from 'fudgel';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TorchService } from '../services/torch.service';
import { WakeLockService } from '../services/wake-lock.service';

@Component('flashlight-app', {
    style: css`
        :host {
            height: 100%;
            width: 100%;
        }

        .wrapper {
            height: 100%;
            width: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
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
        <default-layout *if="showControls">
            <div class="wrapper">
                <pretty-button
                    .enabled="enabled"
                    @click.stop.prevent="toggle()"
                >
                    <scaling-icon href="/flashlight.svg"></scaling-icon>
                </pretty-button>
            </div>
        </default-layout>
    `,
})
export class FlashlightAppComponent {
    private _subject = new Subject();
    private _torchService = di(TorchService);
    private _wakeLockService = di(WakeLockService);
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
                    value === AvailabilityState.UNAVAILABLE ||
                    value === AvailabilityState.ERROR;
                this.showControls = value === AvailabilityState.ALLOWED;

                if (this.showControls) {
                    this._getCurrentStatus();
                }
            });
    }

    onDestroy() {
        this._subject.next(null);
        this._subject.complete();
        this._wakeLockService.release();
    }

    grant() {
        this.explainAsk = false;
        this._torchService.prompt();
    }

    toggle() {
        if (this.enabled) {
            this._wakeLockService.release();
            this._torchService.turnOff();
        } else {
            this._torchService.turnOn();
            this._wakeLockService.request();
        }

        this.enabled = !this.enabled;
    }

    private _getCurrentStatus() {
        this._torchService.currentStatus().then((enabled) => {
            this.enabled = enabled;
        });
    }
}
