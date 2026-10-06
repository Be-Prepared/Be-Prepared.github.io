import { AccessState } from '../services/access/access-controller';
import {
    CameraService,
    getVideoTrack,
    hasTorch,
    isTorchOn,
    setTorch,
} from '../services/camera.service';
import { component, css, html } from 'fudgel';
import { di } from '../di';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { WakeLockService } from '../services/wake-lock.service';

export class FlashlightAppComponent {
    private _camera = di(CameraService).controller({
        // Keep the light on if the person switches to another app.
        releaseWhenHidden: false,
    });
    private _noTorch = false;
    private _subject = new Subject();
    private _wakeLockService = di(WakeLockService);
    enabled = false;
    powerClass = 'power';
    stateLabel = 'flashlight.off';
    screenState = AccessState.CHECKING;

    onInit() {
        this._camera.state
            .pipe(takeUntil(this._subject))
            .subscribe((state) => this._updateScreenState(state));
        this._camera.resourceChanges
            .pipe(takeUntil(this._subject))
            .subscribe(() => this._updateScreenState(this._camera.currentState));
        this._camera.init();
    }

    onDestroy() {
        this._subject.next(null);
        this._subject.complete();
        this._camera.destroy();
        this._wakeLockService.release();
    }

    grant() {
        this._camera.request();
    }

    toggle() {
        const track = getVideoTrack(this._camera.resource);
        const turnOn = !this.enabled;

        setTorch(track, turnOn)
            .catch(() => {})
            .then(() => {
                this._setEnabled(isTorchOn(track));

                if (!turnOn && this.enabled) {
                    // Some devices ignore the request to turn off the light.
                    // Stopping the camera always works; start it again so
                    // the button keeps working.
                    this._setEnabled(false);
                    this._camera.release();
                    this._camera.request();
                }

                if (this.enabled) {
                    this._wakeLockService.request();
                } else {
                    this._wakeLockService.release();
                }
            });
    }

    private _setEnabled(enabled: boolean) {
        this.enabled = enabled;
        this.powerClass = enabled ? 'power on' : 'power';
        this.stateLabel = enabled ? 'flashlight.on' : 'flashlight.off';
    }

    private _updateScreenState(state: AccessState) {
        const track = getVideoTrack(this._camera.resource);

        if (state === AccessState.READY && track && !hasTorch(track)) {
            // Release the camera right away. It has no light, so there's no
            // reason to hold on to it.
            this._noTorch = true;
            this._camera.release();
        }

        if (this._noTorch) {
            this.screenState = AccessState.UNAVAILABLE;

            return;
        }

        this._setEnabled(isTorchOn(track));
        this.screenState = state;
    }
}

component(
    'flashlight-app',
    {
        style: css`
            :host {
                height: 100%;
                width: 100%;
            }

            .wrapper {
                height: 100%;
                width: 100%;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                gap: var(--space-4);
            }

            .power {
                width: min(60vmin, 18rem);
                height: min(60vmin, 18rem);
                border-radius: 50%;
                border: 2px solid var(--border);
                background: var(--surface);
                color: var(--fg);
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-family: inherit;
                transition: background-color 0.2s, box-shadow 0.2s,
                    color 0.2s;
                -webkit-tap-highlight-color: transparent;
            }

            .power.on {
                background: var(--accent);
                border-color: var(--accent);
                color: var(--accent-fg);
                box-shadow: 0 0 4rem var(--accent-glow);
            }

            .icon {
                width: 45%;
                height: 45%;
            }

            .state {
                font-size: 1.25rem;
                font-weight: 600;
                color: var(--fg-muted);
            }
        `,
        template: html`
            <access-screen
                *if="screenState !== 'READY'"
                state="{{screenState}}"
                icon="/camera.svg"
                message-id="flashlight.explainAsk"
                unavailable-id="flashlight.unavailableMessage"
                @grant.stop.prevent="grant()"
            ></access-screen>
            <default-layout *if="screenState === 'READY'">
                <div class="wrapper">
                    <button
                        class="{{powerClass}}"
                        @click.stop.prevent="toggle()"
                        aria-pressed="{{enabled}}"
                    >
                        <load-svg class="icon" href="/flashlight.svg"></load-svg>
                    </button>
                    <div class="state">
                        <i18n-label
                            id="{{stateLabel}}"
                            ws=""
                        ></i18n-label>
                    </div>
                </div>
            </default-layout>
        `,
    },
    FlashlightAppComponent
);
