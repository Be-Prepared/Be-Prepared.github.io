import { AccessState } from '../services/access/access-controller';
import {
    CameraService,
    getVideoTrack,
    hasTorch,
    isTorchOn,
    setTorch,
} from '../services/camera.service';
import {
    combinedAccess,
    formatDegrees,
    hangingReading,
    nextIsLevel,
    pitchDirection,
    rollDirection,
} from './picture-hanging-math';
import { component, css, html } from 'fudgel';
import { di } from '../di';
import { MotionService } from '../services/motion.service';
import { smoothVector, Vector3 } from '../services/motion/motion-math';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// Fraction of each new reading to blend in. Lower is calmer but laggier.
const SMOOTHING = 0.2;

export class PictureHangingAppComponent {
    private _camera = di(CameraService).controller({ facing: 'environment', switchable: true });
    // For the template: names starting with "_" are shortened by the
    // production build, so templates can't use them.
    cameraController = this._camera;
    private _cameraState = AccessState.CHECKING;
    private _frame: ReturnType<typeof requestAnimationFrame> | null = null;
    private _gravity: Vector3 | null = null;
    private _isLevel = false;
    private _motionService = di(MotionService);
    private _motionState = AccessState.CHECKING;
    private _stream: MediaStream | null = null;
    private _subject = new Subject();
    private _track: MediaStreamTrack | null = null;
    accessIcon = '/camera.svg';
    accessMessage = 'pictureHanging.explainCamera';
    accessUnavailable = 'pictureHanging.cameraUnavailable';
    horizon?: HTMLElement;
    pitchText = '';
    pitchDirectionId = '';
    rollText = '';
    rollDirectionId = '';
    screenState = AccessState.CHECKING;
    stateClass = 'view';
    statusId = '';
    torchAvailable = false;
    torchEnabled = false;
    upright = true;
    video?: HTMLVideoElement;
    waiting = false;

    onInit() {
        this._camera.state.pipe(takeUntil(this._subject)).subscribe((state) => {
            this._cameraState = state;
            this._updateAccess();
        });
        this._camera.resourceChanges
            .pipe(takeUntil(this._subject))
            .subscribe((stream) => this._attach(stream));
        this._camera.init();
        this._motionService
            .watch()
            .pipe(takeUntil(this._subject))
            .subscribe((update) => {
                this._motionState = update.state;
                this.waiting = update.waiting || !update.gravity;

                if (update.gravity) {
                    this._gravity = smoothVector(
                        this._gravity,
                        update.gravity,
                        SMOOTHING
                    );
                }

                this._updateAccess();
                this._scheduleRender();
            });
    }

    onDestroy() {
        this._subject.next(null);
        this._subject.complete();
        this._camera.destroy();

        if (this._frame !== null) {
            cancelAnimationFrame(this._frame);
        }
    }

    grant() {
        if (this._cameraState !== AccessState.READY) {
            this._camera.request();
        } else {
            this._motionService.requestPermission();
        }
    }

    toggleTorch() {
        const track = this._track;

        setTorch(track, !this.torchEnabled)
            .catch(() => {})
            .then(() => {
                this.torchEnabled = isTorchOn(track);
            });
    }

    private _attach(stream: MediaStream | null) {
        const track = getVideoTrack(stream);
        this._stream = stream;
        this._track = track;
        this.torchAvailable = hasTorch(track);
        this.torchEnabled = isTorchOn(track);
        this._attachVideo();
    }

    private _attachVideo() {
        // The video element only exists while everything is ready and is
        // rendered a tick after that.
        setTimeout(() => {
            if (this.video && this.video.srcObject !== this._stream) {
                this.video.srcObject = this._stream;
            }

            this._scheduleRender();
        });
    }

    private _render() {
        const gravity = this._gravity;

        if (!gravity) {
            this.rollText = '';
            this.pitchText = '';
            this.rollDirectionId = '';
            this.pitchDirectionId = '';
            this.statusId = '';
            this._setLevel(false);

            return;
        }

        const reading = hangingReading(gravity);
        this.upright = reading.upright;
        this.rollText = formatDegrees(reading.roll);
        this.pitchText = formatDegrees(reading.pitch);
        this._setLevel(nextIsLevel(this._isLevel, reading));
        this.statusId = this._isLevel ? 'pictureHanging.level' : '';
        const roll = rollDirection(reading.roll);
        const pitch = pitchDirection(reading.pitch);
        this.rollDirectionId = roll ? `pictureHanging.${roll}` : '';
        this.pitchDirectionId = pitch ? `pictureHanging.${pitch}` : '';

        if (this.horizon) {
            this.horizon.style.transform = `rotate(${reading.rotation}deg)`;
        }
    }

    private _scheduleRender() {
        if (this._frame === null) {
            // Sensors can fire far faster than the screen refreshes.
            this._frame = requestAnimationFrame(() => {
                this._frame = null;
                this._render();
            });
        }
    }

    private _setLevel(isLevel: boolean) {
        this._isLevel = isLevel;
        this.stateClass = isLevel ? 'view is-level' : 'view';
    }

    private _updateAccess() {
        const access = combinedAccess(this._cameraState, this._motionState);
        const wasReady = this.screenState === AccessState.READY;
        this.screenState = access.state;

        if (access.source === 'camera') {
            this.accessIcon = '/camera.svg';
            this.accessMessage = 'pictureHanging.explainCamera';
            this.accessUnavailable = 'pictureHanging.cameraUnavailable';
        } else {
            this.accessIcon = '/level.svg';
            this.accessMessage = 'pictureHanging.explainMotion';
            this.accessUnavailable = 'pictureHanging.motionUnavailable';
        }

        if (!wasReady && access.state === AccessState.READY) {
            this._attachVideo();
        }
    }
}

component(
    'picture-hanging-app',
    {
        style: css`
            :host {
                display: block;
                height: 100%;
                width: 100%;
            }

            .view {
                position: absolute;
                inset: 0;
                overflow: hidden;
                background: #000;
                z-index: 0;
            }

            video {
                height: 100%;
                width: 100%;
                object-fit: cover;
            }

            .cross,
            .horizon {
                position: absolute;
                inset: 0;
                pointer-events: none;
            }

            .line {
                position: absolute;
                left: 50%;
                top: 50%;
            }

            /* The fixed cross marks the phone's own axes. */
            .cross .h {
                left: 0;
                right: 0;
                height: 1px;
                margin-top: -0.5px;
                background: #fffc;
                box-shadow: 0 0 2px #000;
            }

            .cross .v {
                top: 0;
                bottom: 0;
                width: 1px;
                margin-left: -0.5px;
                background: #fffc;
                box-shadow: 0 0 2px #000;
            }

            /* Long enough to cross the screen at any angle. */
            .horizon .h {
                width: 300vmax;
                height: 2px;
                margin: -1px 0 0 -150vmax;
                background: var(--accent);
                box-shadow: 0 0 3px #000;
            }

            .horizon .v {
                height: 300vmax;
                width: 2px;
                margin: -150vmax 0 0 -1px;
                background: var(--accent);
                box-shadow: 0 0 3px #000;
            }

            .is-level .horizon .line {
                background: var(--success);
            }

            .badge {
                position: absolute;
                top: calc(env(safe-area-inset-top) + var(--space-3));
                left: 50%;
                transform: translateX(-50%);
                display: grid;
                grid-template-columns: auto auto auto;
                align-items: baseline;
                column-gap: var(--space-2);
                row-gap: var(--space-1);
                padding: var(--space-2) var(--space-4);
                border-radius: var(--radius-l);
                border: 2px solid transparent;
                background: var(--overlay-bg);
                color: #fff;
                pointer-events: none;
                white-space: nowrap;
            }

            .is-level .badge {
                border-color: var(--success);
            }

            .label {
                font-size: 0.9rem;
                opacity: 0.85;
            }

            .value {
                font-size: 1.6rem;
                font-weight: 700;
                font-variant-numeric: tabular-nums;
                text-align: end;
            }

            .is-level .value,
            .is-level .status {
                color: var(--success);
            }

            .direction {
                font-size: 0.9rem;
                opacity: 0.85;
                min-width: 7.5rem;
            }

            .status,
            .notice {
                grid-column: 1 / -1;
                text-align: center;
                font-weight: 700;
                white-space: normal;
            }

            .notice {
                font-weight: 400;
                max-width: 16rem;
                justify-self: center;
            }
        `,
        template: html`
            <access-screen
                *if="screenState !== 'READY'"
                state="{{screenState}}"
                icon="{{accessIcon}}"
                message-id="{{accessMessage}}"
                unavailable-id="{{accessUnavailable}}"
                @grant.stop.prevent="grant()"
            ></access-screen>
            <div *if="screenState === 'READY'" class="{{stateClass}}">
                <video #ref="video" autoplay muted playsinline></video>
                <div class="cross">
                    <div class="line h"></div>
                    <div class="line v"></div>
                </div>
                <div class="horizon" #ref="horizon">
                    <div class="line h"></div>
                    <div class="line v"></div>
                </div>
                <div class="badge">
                    <span class="label"
                        ><i18n-label id="pictureHanging.tilt" ws=""></i18n-label
                    ></span>
                    <span class="value">{{rollText}}</span>
                    <span class="direction"
                        ><i18n-label
                            *if="rollDirectionId"
                            id="{{rollDirectionId}}"
                            ws=""
                        ></i18n-label
                    ></span>
                    <span class="label"
                        ><i18n-label id="pictureHanging.lean" ws=""></i18n-label
                    ></span>
                    <span class="value">{{pitchText}}</span>
                    <span class="direction"
                        ><i18n-label
                            *if="pitchDirectionId"
                            id="{{pitchDirectionId}}"
                            ws=""
                        ></i18n-label
                    ></span>
                    <div *if="statusId" class="status">
                        <i18n-label id="{{statusId}}" ws=""></i18n-label>
                    </div>
                    <div *if="!upright" class="notice">
                        <i18n-label
                            id="pictureHanging.holdUpright"
                            ws=""
                        ></i18n-label>
                    </div>
                    <div *if="waiting" class="notice">
                        <i18n-label
                            id="pictureHanging.waiting"
                            ws=""
                        ></i18n-label>
                    </div>
                </div>
            </div>
            <default-layout *if="screenState === 'READY'" overlay>
                <icon-button
                    slot="more-buttons"
                    *if="torchAvailable"
                    href="/flashlight.svg"
                    label-id="shared.torch"
                    .active="torchEnabled"
                    @click.stop.prevent="toggleTorch()"
                ></icon-button>
                <camera-switch
                    slot="more-buttons"
                    .camera="cameraController"
                ></camera-switch>
            </default-layout>
        `,
    },
    PictureHangingAppComponent
);
