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

        .buttonBar {
            width: 100%;
            display: flex;
            justify-content: space-between;
        }

        .deviceIssue {
            padding: 0 10%;
            text-align: center;
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
            <pretty-button
                *if="!deviceIssue"
                .enabled="enabled"
                @click.stop.prevent="toggle()"
            >
                <scaling-icon href="/flashlight.svg"></scaling-icon>
            </pretty-button>
            <div *if="deviceIssue" class="deviceIssue">
                <i18n-label id="flashlight.deviceIssue"></i18n-label>
            </div>
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
    deviceIssue = false;
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
            this._torchService.turnOff().then(() => {
                this._checkIfStillEnabled();
            })
        } else {
            this._torchService.turnOn();
        }

        this.enabled = !this.enabled;
    }

    private _checkIfStillEnabled() {
        this._torchService.currentStatus().then((enabled) => {
            // Some devices just don't turn off the flash when asked.  Seems to
            // be a problem with a paticular brand. If a workaround is found,
            // that would be preferred to reloading the app.
            if (enabled) {
                this.deviceIssue = true;
                window.location.reload();
            }
        });
    }

    private _getCurrentStatus() {
        this._wakeLockService.request();
        this._torchService.currentStatus().then((enabled) => {
            this.enabled = enabled;
        });
    }
}
