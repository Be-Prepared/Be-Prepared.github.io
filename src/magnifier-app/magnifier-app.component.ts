import { AvailabilityState } from '../datatypes/availability-state';
import { Component, css, di, html } from 'fudgel';
import { MagnifierService } from '../services/magnifier.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TorchService } from '../services/torch.service';

@Component('magnifier-app', {
    style: css`
        :host,
        .wrapper {
            height: 100%;
            width: 100%;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: center;
        }

        video {
            height: 100%;
            width: 100%;
            object-fit: cover;
            touch-action: none;
        }

        .bottom {
            position: absolute;
            bottom: 0;
            left: 0;
            display: flex;
            width: 100%;
            justify-content: space-between;
        }

        .enabled {
            color: var(--button-fg-color-enabled);
        }
    `,
    template: html`
        <permission-prompt
            *if="explainAsk"
            @grant.stop.prevent="grant()"
            message-id="magnifier.explainAsk"
        ></permission-prompt>
        <permission-denied *if="explainDeny"></permission-denied>
        <camera-unavailable *if="explainUnavailable"></camera-unavailable>
        <div *if="showControls" class="wrapper">
            <video
                @pointerdown.stop.prevent="pointerDown($event)"
                @pointermove.stop.prevent="pointerMove($event)"
                @pointerup.stop.prevent="pointerUp($event)"
                @pointercancel.stop.prevent="pointerUp($event)"
                @pointerout.stop.prevent="pointerUp($event)"
                @pointerleave.stop.prevent="pointerUp($event)"
                #ref="video"
                autoplay
                muted
                playsinline
            ></video>
            <div class="bottom">
                <back-button></back-button>
                <div></div>
                <scaling-icon
                    *if="torchAvailable"
                    @click.stop.prevent="toggleTorch()"
                    class="{{torchClass}}"
                    href="flashlight.svg"
                ></scaling-icon>
            </div>
        </div>
    `,
})
export class MagnifierAppComponent {
    #magnifierService = di(MagnifierService);
    #pointerInitialDiff: number | null = null;
    #pointerInitialZoom: number | null = null;
    #pointerEventCache: PointerEvent[] = [];
    #subject = new Subject();
    #torchService = di(TorchService);
    #track?: MediaStreamTrack;
    #zoomCurrent: number | null = null;
    #zoomMax: number | null = null;
    #zoomMin: number | null = null;
    #zoomScale: number | null = null;
    #zoomStep: number | null = null;
    explainAsk = false;
    explainDeny = false;
    explainUnavailable = false;
    showControls = false;
    torchAvailable = false;
    torchClass = '';
    torchEnabled = false;
    video?: HTMLVideoElement;

    onInit() {
        this.#magnifierService
            .availabilityState(true)
            .pipe(takeUntil(this.#subject))
            .subscribe((value) => {
                this.explainAsk = value === AvailabilityState.PROMPT;
                this.explainDeny = value === AvailabilityState.DENIED;
                this.explainUnavailable =
                    value === AvailabilityState.UNAVAILABLE;
                const showVideo = value === AvailabilityState.ALLOWED;

                if (this.showControls !== showVideo) {
                    this.showControls = showVideo;

                    if (this.showControls) {
                        this.#startVideoStream();
                    } else {
                        this.#endVideoStream();
                    }
                }
            });
        this.#torchService
            .availabilityState(true)
            .pipe(takeUntil(this.#subject))
            .subscribe((value) => {
                this.torchAvailable = value === AvailabilityState.ALLOWED;
            });
    }

    onDestroy() {
        this.#subject.next(null);
        this.#subject.complete();
    }

    grant() {
        this.#magnifierService.prompt();
    }

    pointerDown(event: PointerEvent) {
        this.#pointerEventCache.push(event);
        this.#pointerInitialDiff = this.#pointerDiff();
        this.#pointerInitialZoom = this.#zoomCurrent;
    }

    pointerMove(event: PointerEvent) {
        // Update the cached pointer
        for (let i = 0; i < this.#pointerEventCache.length; i += 1) {
            if (this.#pointerEventCache[i].pointerId === event.pointerId) {
                this.#pointerEventCache[i] = event;
            }
        }

        const diff = this.#pointerDiff();

        if (
            !diff ||
            !this.#pointerInitialDiff ||
            !this.#pointerInitialZoom ||
            !this.#zoomScale ||
            !this.#zoomMax ||
            !this.#zoomMin ||
            !this.#zoomStep
        ) {
            return;
        }

        const change = diff - this.#pointerInitialDiff;
        const scaled = change / this.#zoomScale;
        const stepsTotal = (this.#zoomMax - this.#zoomMin) / this.#zoomStep;
        const stepsChange = scaled * stepsTotal;
        const endZoom =
            this.#pointerInitialZoom + Math.floor(stepsChange) * this.#zoomStep;

        this.#zoom(endZoom);
    }

    pointerUp(event: PointerEvent) {
        this.#pointerEventCache = this.#pointerEventCache.filter(
            (previousEvent) => {
                return previousEvent.pointerId !== event.pointerId;
            }
        );
    }

    toggleTorch() {
        if (this.torchEnabled) {
            this.#torchService.turnOff();
        } else {
            this.#torchService.turnOn();
        }

        this.#setupTorch();
    }

    #endVideoStream() {
        this.#zoomCurrent = null;
        this.#zoomMin = null;
        this.#zoomMax = null;
        this.#zoomStep = null;
    }

    #pointerDiff() {
        if (this.#pointerEventCache.length === 2) {
            const first = this.#pointerEventCache[0];
            const second = this.#pointerEventCache[1];

            return Math.sqrt(
                Math.pow(second.clientX - first.clientX, 2) +
                    Math.pow(second.clientY - first.clientY, 2)
            );
        }

        return null;
    }

    #setupTorch() {
        this.#torchService.currentStatus().then((enabled) => {
            this.torchEnabled = enabled;
            this.torchClass = enabled ? 'enabled' : '';
        });
    }

    #startVideoStream() {
        this.#magnifierService.getStream().then((stream) => {
            const track = stream.getVideoTracks()[0];

            if (!track) {
                // console.log('no video track');
                return;
            }

            const zoom = (track.getCapabilities() as any).zoom;
            // console.log('zoom', zoom);

            if (zoom) {
                this.#zoomMin = zoom.min;
                this.#zoomMax = zoom.max;
                this.#zoomStep = zoom.step;
                this.#track = track;
                this.#zoom(this.#zoomMax!);
            }

            if (this.video) {
                this.video.srcObject = stream;
            }

            this.#zoomScale =
                Math.min(window.screen.width + window.screen.height) / 2;
            this.#setupTorch();
        });
    }

    #zoom(zoom: number) {
        if (!this.#zoomMax || !this.#zoomMin || !this.#track) {
            return;
        }

        zoom = Math.min(this.#zoomMax, zoom);
        zoom = Math.max(this.#zoomMin, zoom);
        this.#zoomCurrent = zoom;
        this.#track.applyConstraints({
            advanced: [
                {
                    zoom: zoom,
                } as any,
            ],
        });
    }
}
