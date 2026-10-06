import { AccessState } from '../services/access/access-controller';
import { CameraService } from '../services/camera.service';
import { component, css, html } from 'fudgel';
import { di } from '../di';
import {
    formatZoom,
    planZoom,
    stepZoom,
    zoomLimits,
} from '../magnifier-app/zoom';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export class MirrorAppComponent {
    private _camera = di(CameraService).controller({ facing: 'user' });
    private _subject = new Subject();
    private _zoom = 1;
    canZoomIn = true;
    canZoomOut = false;
    freezeIcon = '/pause.svg';
    freezeLabel = 'mirror.freeze';
    frozen = false;
    ring = false;
    screenState = AccessState.CHECKING;
    video?: HTMLVideoElement;
    viewportClass = 'viewport';
    zoomLabel = '';

    onInit() {
        this._camera.state
            .pipe(takeUntil(this._subject))
            .subscribe((state) => (this.screenState = state));
        this._camera.resourceChanges
            .pipe(takeUntil(this._subject))
            .subscribe((stream) => this._attach(stream));
        this._camera.init();
    }

    onDestroy() {
        this._subject.next(null);
        this._subject.complete();
        this._camera.destroy();
    }

    grant() {
        this._camera.request();
    }

    toggleFreeze() {
        this._setFrozen(!this.frozen);

        if (this.video) {
            if (this.frozen) {
                this.video.pause();
            } else {
                this.video.play().catch(() => {});
            }
        }
    }

    toggleRing() {
        this.ring = !this.ring;
        this.viewportClass = this.ring ? 'viewport ring' : 'viewport';
    }

    zoomIn() {
        this._setZoom(stepZoom(this._zoom, 1));
    }

    zoomOut() {
        this._setZoom(stepZoom(this._zoom, -1));
    }

    private _attach(stream: MediaStream | null) {
        // A new stream after returning from the background is live again.
        this._setFrozen(false);

        if (!stream) {
            return;
        }

        // Wait a tick for the video element to be rendered.
        setTimeout(() => {
            if (this.video && this._camera.resource === stream) {
                this.video.srcObject = stream;
            }

            this._setZoom(this._zoom);
        });
    }

    private _setFrozen(frozen: boolean) {
        this.frozen = frozen;
        this.freezeIcon = frozen ? '/play.svg' : '/pause.svg';
        this.freezeLabel = frozen ? 'mirror.resume' : 'mirror.freeze';
    }

    // Front cameras rarely offer hardware zoom, so this is all digital.
    private _setZoom(requested: number) {
        const plan = planZoom(requested, null);
        const limits = zoomLimits(null);
        this._zoom = plan.total;
        this.zoomLabel = formatZoom(plan.total);
        this.canZoomIn = plan.total < limits.max - 1e-6;
        this.canZoomOut = plan.total > limits.min + 1e-6;

        if (this.video) {
            // Flipped sideways so it behaves like a real mirror.
            this.video.style.transform = `scale(${-plan.digital}, ${plan.digital})`;
        }
    }
}

component(
    'mirror-app',
    {
        style: css`
            :host {
                display: block;
                height: 100%;
                width: 100%;
            }

            .viewport {
                position: absolute;
                inset: 0;
                background: #000;
                z-index: 0;
                box-sizing: border-box;
                transition:
                    padding 0.2s,
                    background-color 0.2s;
            }

            /* A wide white frame lights the face in the dark. */
            .viewport.ring {
                background: #fff;
                padding: min(14vmin, 5rem);
            }

            .clip {
                height: 100%;
                width: 100%;
                overflow: hidden;
                border-radius: 0;
            }

            .ring .clip {
                border-radius: var(--radius-l);
            }

            video {
                display: block;
                height: 100%;
                width: 100%;
                object-fit: cover;
                transform: scaleX(-1);
                transform-origin: center center;
            }

            .zoom-label {
                position: absolute;
                top: calc(var(--space-3) + env(safe-area-inset-top));
                left: 50%;
                transform: translateX(-50%);
                padding: var(--space-1) var(--space-3);
                border-radius: 999px;
                background: var(--overlay-bg);
                color: #fff;
                font-weight: 700;
                font-variant-numeric: tabular-nums;
                pointer-events: none;
            }
        `,
        template: html`
            <access-screen
                *if="screenState !== 'READY'"
                state="{{screenState}}"
                icon="/mirror.svg"
                message-id="mirror.explainAsk"
                unavailable-id="mirror.unavailable"
                @grant.stop.prevent="grant()"
            ></access-screen>
            <div *if="screenState === 'READY'" class="{{viewportClass}}">
                <div class="clip">
                    <video #ref="video" autoplay muted playsinline></video>
                </div>
                <div class="zoom-label">{{zoomLabel}}</div>
            </div>
            <default-layout *if="screenState === 'READY'" overlay>
                <icon-button
                    slot="more-buttons"
                    href="/front-light.svg"
                    label-id="mirror.ring"
                    .active="ring"
                    @click.stop.prevent="toggleRing()"
                ></icon-button>
                <icon-button
                    slot="more-buttons"
                    href="/zoom-out.svg"
                    label-id="mirror.zoomOut"
                    .disabled="!canZoomOut"
                    @click.stop.prevent="zoomOut()"
                ></icon-button>
                <icon-button
                    slot="more-buttons"
                    href="/zoom-in.svg"
                    label-id="mirror.zoomIn"
                    .disabled="!canZoomIn"
                    @click.stop.prevent="zoomIn()"
                ></icon-button>
                <icon-button
                    slot="more-buttons"
                    href="{{freezeIcon}}"
                    label-id="{{freezeLabel}}"
                    .active="frozen"
                    @click.stop.prevent="toggleFreeze()"
                ></icon-button>
            </default-layout>
        `,
    },
    MirrorAppComponent
);
