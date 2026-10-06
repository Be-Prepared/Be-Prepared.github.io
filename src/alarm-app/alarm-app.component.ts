import {
    AccessController,
    AccessState,
} from '../services/access/access-controller';
import { AlarmSoundService } from '../services/alarm-sound.service';
import {
    CameraService,
    getVideoTrack,
    hasTorch,
    setTorch,
} from '../services/camera.service';
import { component, css, html } from 'fudgel';
import { di } from '../di';
import {
    msUntilToggle,
    SCREEN_HALF_PERIOD_MS,
    strobeOn,
    TORCH_HALF_PERIOD_MS,
} from './strobe';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { WakeLockService } from '../services/wake-lock.service';

// Three ways to get attention, usable in any combination: a blinking
// flashlight, a siren, and a flashing screen.
export class AlarmAppComponent {
    private _alarmSound = di(AlarmSoundService);
    private _camera: AccessController<MediaStream> | null = null;
    private _cameraService = di(CameraService);
    private _lightSubject = new Subject();
    private _lightTimer: ReturnType<typeof setTimeout> | null = null;
    private _screenTimer: ReturnType<typeof setTimeout> | null = null;
    private _wakeLockService = di(WakeLockService);
    lightClass = 'toggle';
    lightOn = false;
    lightStatus = 'alarm.off';
    lightUnavailable = false;
    screenClass = 'toggle';
    screenFlashClass = 'screen-flash';
    screenOn = false;
    screenStatus = 'alarm.off';
    sirenClass = 'toggle';
    sirenOn = false;
    sirenStatus = 'alarm.off';
    sirenUnavailable = false;

    onInit() {
        this.sirenUnavailable = !this._alarmSound.isSupported();
        // Checking for a camera doesn't need permission or turn it on.
        this._cameraService.hasCamera().then((hasCamera) => {
            if (!hasCamera) {
                this.lightUnavailable = true;
                this._update();
            }
        });
        this._update();
    }

    onDestroy() {
        this._stopLight();
        this._stopSiren();
        this._stopScreen();
        this._lightSubject.complete();
        this._wakeLockService.release();
    }

    toggleLight() {
        if (this.lightOn) {
            this._stopLight();
        } else if (!this.lightUnavailable) {
            this._startLight();
        }

        this._update();
    }

    toggleScreen() {
        if (this.screenOn) {
            this._stopScreen();
        } else {
            this._startScreen();
        }

        this._update();
    }

    toggleSiren() {
        if (this.sirenOn) {
            this._stopSiren();
        } else if (!this.sirenUnavailable) {
            // Called from the tap, which browsers require before playing
            // sound.
            this._alarmSound.start('siren', 1);
            this.sirenOn = true;
        }

        this._update();
    }

    private _lightState(state: AccessState) {
        switch (state) {
            case AccessState.DENIED:
                this._stopLight();
                this.lightStatus = 'alarm.denied';
                break;

            case AccessState.UNAVAILABLE:
                this.lightUnavailable = true;
                this._stopLight();
                break;

            case AccessState.ERROR:
                this._stopLight();
                this.lightStatus = 'alarm.error';
                break;
        }

        this._update();
    }

    private _lightStream(stream: MediaStream | null) {
        const track = getVideoTrack(stream);

        if (track && !hasTorch(track)) {
            // The camera has no light. Give it back right away.
            this.lightUnavailable = true;
            this._stopLight();
            this._update();
        }
    }

    private _lightTick(startedAt: number) {
        const elapsed = Date.now() - startedAt;
        const track = getVideoTrack(this._camera?.resource);

        if (track) {
            setTorch(track, strobeOn(elapsed, TORCH_HALF_PERIOD_MS)).catch(
                () => {}
            );
        }

        this._lightTimer = setTimeout(
            () => this._lightTick(startedAt),
            msUntilToggle(elapsed, TORCH_HALF_PERIOD_MS)
        );
    }

    private _screenTick(startedAt: number) {
        const elapsed = Date.now() - startedAt;
        this.screenFlashClass = strobeOn(elapsed, SCREEN_HALF_PERIOD_MS)
            ? 'screen-flash bright'
            : 'screen-flash red';
        this._screenTimer = setTimeout(
            () => this._screenTick(startedAt),
            msUntilToggle(elapsed, SCREEN_HALF_PERIOD_MS)
        );
    }

    private _startLight() {
        // The camera is only opened while the strobe is on. It's released
        // while the app is in the background and picked up again on return.
        const camera = this._cameraService.controller({
            facing: 'environment',
        });
        this._camera = camera;
        this.lightOn = true;
        camera.state
            .pipe(takeUntil(this._lightSubject))
            .subscribe((state) => this._lightState(state));
        camera.resourceChanges
            .pipe(takeUntil(this._lightSubject))
            .subscribe((stream) => this._lightStream(stream));
        camera.init();
        // From the tap, so the browser can ask for permission.
        camera.request();
        this._lightTick(Date.now());
    }

    private _startScreen() {
        this.screenOn = true;
        this._screenTick(Date.now());
    }

    private _stopLight() {
        if (this._lightTimer !== null) {
            clearTimeout(this._lightTimer);
            this._lightTimer = null;
        }

        this._lightSubject.next(null);

        if (this._camera) {
            // Closing the camera also turns the light off.
            this._camera.destroy();
            this._camera = null;
        }

        this.lightOn = false;
    }

    private _stopScreen() {
        if (this._screenTimer !== null) {
            clearTimeout(this._screenTimer);
            this._screenTimer = null;
        }

        this.screenOn = false;
    }

    private _stopSiren() {
        this._alarmSound.stop();
        this.sirenOn = false;
    }

    private _toggleClass(on: boolean, unavailable: boolean) {
        if (unavailable) {
            return 'toggle unavailable';
        }

        return on ? 'toggle on' : 'toggle';
    }

    private _update() {
        this.lightClass = this._toggleClass(
            this.lightOn,
            this.lightUnavailable
        );
        this.sirenClass = this._toggleClass(
            this.sirenOn,
            this.sirenUnavailable
        );
        this.screenClass = this._toggleClass(this.screenOn, false);

        if (this.lightUnavailable) {
            this.lightStatus = 'alarm.lightUnavailable';
        } else if (this.lightOn) {
            this.lightStatus = 'alarm.on';
        } else if (
            this.lightStatus !== 'alarm.denied' &&
            this.lightStatus !== 'alarm.error'
        ) {
            this.lightStatus = 'alarm.off';
        }

        this.sirenStatus = this.sirenUnavailable
            ? 'alarm.sirenUnavailable'
            : this.sirenOn
              ? 'alarm.on'
              : 'alarm.off';
        this.screenStatus = this.screenOn ? 'alarm.on' : 'alarm.off';

        if (this.lightOn || this.sirenOn || this.screenOn) {
            this._wakeLockService.request();
        } else {
            this._wakeLockService.release();
        }
    }
}

component(
    'alarm-app',
    {
        style: css`
            .wrapper {
                display: flex;
                flex-direction: column;
                justify-content: center;
                gap: var(--space-3);
                min-height: 100%;
                width: 100%;
                max-width: 32rem;
                margin: 0 auto;
                box-sizing: border-box;
            }

            .toggle {
                display: flex;
                align-items: center;
                gap: var(--space-4);
                width: 100%;
                padding: var(--space-4);
                border-radius: var(--radius-l);
                border: 2px solid var(--border);
                background: var(--surface);
                color: var(--fg);
                font-family: inherit;
                text-align: start;
                cursor: pointer;
                box-shadow: var(--shadow);
                -webkit-tap-highlight-color: transparent;
                transition:
                    background-color 0.15s,
                    border-color 0.15s,
                    transform 0.1s;
            }

            .toggle:active {
                transform: scale(0.98);
            }

            .toggle:focus-visible {
                outline: 3px solid var(--accent);
                outline-offset: 2px;
            }

            .toggle.on {
                background: var(--accent);
                border-color: var(--accent);
                color: var(--accent-fg);
                box-shadow: 0 0 2rem var(--accent-glow);
            }

            .toggle.unavailable {
                opacity: 0.5;
                cursor: default;
            }

            .icon {
                width: 3.5rem;
                height: 3.5rem;
                flex-shrink: 0;
            }

            .text {
                display: flex;
                flex-direction: column;
                gap: var(--space-1);
                min-width: 0;
            }

            .title {
                font-size: 1.35rem;
                font-weight: 700;
            }

            .status {
                font-size: 1rem;
                font-weight: 600;
                opacity: 0.8;
            }

            .warning {
                font-size: 0.85rem;
                font-weight: 400;
                opacity: 0.85;
            }

            /* Covers everything, including the toolbar. Tapping anywhere
               turns it off. */
            .screen-flash {
                position: fixed;
                inset: 0;
                z-index: 1000;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                -webkit-tap-highlight-color: transparent;
            }

            /* Fixed colors on purpose: the brightest possible screen. */
            .screen-flash.bright {
                background: #ffffff;
            }

            .screen-flash.red {
                background: #ff0000;
            }

            .hint {
                padding: var(--space-3) var(--space-4);
                border-radius: 999px;
                background: rgba(0, 0, 0, 0.75);
                color: #ffffff;
                font-size: 1.1rem;
                font-weight: 600;
                pointer-events: none;
            }

            @media (orientation: landscape) and (max-height: 500px) {
                .wrapper {
                    flex-direction: row;
                    align-items: stretch;
                    max-width: 60rem;
                }

                .toggle {
                    flex: 1 1 0;
                    flex-direction: column;
                    justify-content: center;
                    text-align: center;
                    gap: var(--space-2);
                    padding: var(--space-3);
                }

                .text {
                    align-items: center;
                }
            }
        `,
        template: html`
            <default-layout>
                <div class="wrapper">
                    <button
                        class="{{lightClass}}"
                        aria-pressed="{{lightOn}}"
                        .disabled="lightUnavailable"
                        @click.stop.prevent="toggleLight()"
                    >
                        <load-svg
                            class="icon"
                            href="/flashlight.svg"
                        ></load-svg>
                        <span class="text">
                            <span class="title"
                                ><i18n-label id="alarm.light" ws=""></i18n-label
                            ></span>
                            <span class="status"
                                ><i18n-label
                                    id="{{lightStatus}}"
                                    ws=""
                                ></i18n-label
                            ></span>
                        </span>
                    </button>
                    <button
                        class="{{sirenClass}}"
                        aria-pressed="{{sirenOn}}"
                        .disabled="sirenUnavailable"
                        @click.stop.prevent="toggleSiren()"
                    >
                        <load-svg class="icon" href="/alarm.svg"></load-svg>
                        <span class="text">
                            <span class="title"
                                ><i18n-label id="alarm.siren" ws=""></i18n-label
                            ></span>
                            <span class="status"
                                ><i18n-label
                                    id="{{sirenStatus}}"
                                    ws=""
                                ></i18n-label
                            ></span>
                        </span>
                    </button>
                    <button
                        class="{{screenClass}}"
                        aria-pressed="{{screenOn}}"
                        @click.stop.prevent="toggleScreen()"
                    >
                        <load-svg
                            class="icon"
                            href="/front-light.svg"
                        ></load-svg>
                        <span class="text">
                            <span class="title"
                                ><i18n-label
                                    id="alarm.screen"
                                    ws=""
                                ></i18n-label
                            ></span>
                            <span class="status"
                                ><i18n-label
                                    id="{{screenStatus}}"
                                    ws=""
                                ></i18n-label
                            ></span>
                            <span class="warning"
                                ><i18n-label
                                    id="alarm.photosensitivity"
                                    ws=""
                                ></i18n-label
                            ></span>
                        </span>
                    </button>
                </div>
            </default-layout>
            <div
                *if="screenOn"
                class="{{screenFlashClass}}"
                role="button"
                @click.stop.prevent="toggleScreen()"
            >
                <span class="hint"
                    ><i18n-label id="alarm.tapToStop" ws=""></i18n-label
                ></span>
            </div>
        `,
    },
    AlarmAppComponent
);
