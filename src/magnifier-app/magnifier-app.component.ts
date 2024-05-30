import { AvailabilityState } from '../datatypes/availability-state';
import { Component, css, di, html } from 'fudgel';
import { MagnifierService } from '../services/magnifier.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TorchService } from '../services/torch.service';

@Component('magnifier-app', {
    style: css`
        video {
            height: 100%;
            width: 100%;
            object-fit: cover;
        }

        /* Do not convert pointer events to touch events after 0.3 seconds */
        default-layout {
            touch-action: none;
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
        <video
            *if="showControls"
            #ref="video"
            autoplay
            muted
            playsinline
        ></video>
        <default-layout
            *if="showControls"
            @pointerdown.stop.prevent="pointerDown($event)"
            @pointermove.stop.prevent="pointerMove($event)"
            @pointerup.stop.prevent="pointerUp($event)"
            @pointercancel.stop.prevent="pointerUp($event)"
            @pointerout.stop.prevent="pointerUp($event)"
            @pointerleave.stop.prevent="pointerUp($event)"
        >
            <scaling-icon
                slot="more-buttons"
                *if="torchAvailable"
                @click.stop.prevent="toggleTorch()"
                class="{{torchClass}}"
                href="/flashlight.svg"
            ></scaling-icon>
        </default-layout>
    `,
})
export class MagnifierAppComponent {
    private _magnifierService = di(MagnifierService);
    private _pointerInitialDiff: number | null = null;
    private _pointerInitialZoom: number | null = null;
    private _pointerEventCache: PointerEvent[] = [];
    private _subject = new Subject();
    private _torchService = di(TorchService);
    private _track?: MediaStreamTrack;
    private _zoomCurrent: number | null = null;
    private _zoomMax: number | null = null;
    private _zoomMin: number | null = null;
    private _zoomScale: number | null = null;
    private _zoomStep: number | null = null;
    explainAsk = false;
    explainDeny = false;
    explainUnavailable = false;
    showControls = false;
    torchAvailable = false;
    torchClass = '';
    torchEnabled = false;
    video?: HTMLVideoElement;

    onInit() {
        this._magnifierService
            .availabilityState(true)
            .pipe(takeUntil(this._subject))
            .subscribe((value) => {
                this.explainAsk = value === AvailabilityState.PROMPT;
                this.explainDeny = value === AvailabilityState.DENIED;
                this.explainUnavailable =
                    value === AvailabilityState.UNAVAILABLE;
                const showVideo = value === AvailabilityState.ALLOWED;

                if (this.showControls !== showVideo) {
                    this.showControls = showVideo;

                    if (this.showControls) {
                        this._startVideoStream();
                    } else {
                        this._endVideoStream();
                    }
                }
            });
        this._torchService
            .availabilityState(true)
            .pipe(takeUntil(this._subject))
            .subscribe((value) => {
                this.torchAvailable = value === AvailabilityState.ALLOWED;
            });
    }

    onDestroy() {
        this._zoom(1);
        this._subject.next(null);
        this._subject.complete();
    }

    grant() {
        this.explainAsk = false;
        this._magnifierService.prompt();
    }

    pointerDown(event: PointerEvent) {
        this._pointerEventCache.push(event);
        this._pointerInitialDiff = this._pointerDiff();
        this._pointerInitialZoom = this._zoomCurrent;
    }

    pointerMove(event: PointerEvent) {
        // Update the cached pointer
        for (let i = 0; i < this._pointerEventCache.length; i += 1) {
            if (this._pointerEventCache[i].pointerId === event.pointerId) {
                this._pointerEventCache[i] = event;
            }
        }

        const diff = this._pointerDiff();

        if (
            !diff ||
            !this._pointerInitialDiff ||
            !this._pointerInitialZoom ||
            !this._zoomScale ||
            !this._zoomMax ||
            !this._zoomMin ||
            !this._zoomStep
        ) {
            return;
        }

        const change = diff - this._pointerInitialDiff;
        const scaled = change / this._zoomScale;
        const stepsTotal = (this._zoomMax - this._zoomMin) / this._zoomStep;
        const stepsChange = scaled * stepsTotal;
        const endZoom =
            this._pointerInitialZoom + Math.floor(stepsChange) * this._zoomStep;

        this._zoom(endZoom);
    }

    pointerUp(event: PointerEvent) {
        this._pointerEventCache = this._pointerEventCache.filter(
            (previousEvent) => {
                return previousEvent.pointerId !== event.pointerId;
            }
        );
    }

    toggleTorch() {
        if (this.torchEnabled) {
            this._torchService.turnOff();
        } else {
            this._torchService.turnOn();
        }

        this._setupTorch();
    }

    private _endVideoStream() {
        this._zoomCurrent = null;
        this._zoomMin = null;
        this._zoomMax = null;
        this._zoomStep = null;
    }

    private _pointerDiff() {
        if (this._pointerEventCache.length === 2) {
            const first = this._pointerEventCache[0];
            const second = this._pointerEventCache[1];

            return Math.sqrt(
                Math.pow(second.clientX - first.clientX, 2) +
                    Math.pow(second.clientY - first.clientY, 2)
            );
        }

        return null;
    }

    private _setupTorch() {
        this._torchService.currentStatus().then((enabled) => {
            this.torchEnabled = enabled;
            this.torchClass = enabled ? 'enabled' : '';
        });
    }

    private _startVideoStream() {
        this._magnifierService.getStream().then((stream) => {
            const track = stream.getVideoTracks()[0];

            if (!track) {
                return;
            }

            const zoom = (track.getCapabilities() as any).zoom;

            if (zoom) {
                this._zoomMin = zoom.min;
                this._zoomMax = zoom.max;
                this._zoomStep = zoom.step;
                this._track = track;
                this._zoom(this._zoomMax!);
            }

            if (this.video) {
                this.video.srcObject = stream;
            }

            this._zoomScale =
                Math.min(window.screen.width + window.screen.height) / 2;
            this._setupTorch();
        });
    }

    private _zoom(zoom: number) {
        if (!this._zoomMax || !this._zoomMin || !this._track) {
            return;
        }

        zoom = Math.min(this._zoomMax, zoom);
        zoom = Math.max(this._zoomMin, zoom);
        this._zoomCurrent = zoom;
        this._track.applyConstraints({
            advanced: [
                {
                    zoom: zoom,
                } as any,
            ],
        });
    }
}
