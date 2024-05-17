import { AvailabilityState } from '../datatypes/availability-state';
import { BarcodeReaderService } from '../services/barcode-reader.service';
import { Component, css, di, html } from 'fudgel';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TorchService } from '../services/torch.service';
import { UrlService } from '../services/url.service';

interface DetectedBarcode {
    boundingBox: DOMRectReadOnly;
    cornerPoints: DOMPointReadOnly[];
    format: string;
    rawValue: string;
}

@Component('barcode-reader-app', {
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

        .rawValue {
            background-color: var(--bg-color);
            padding: 1em;
            border-radius: 0.5em;
            font-size: 1.4em;
            word-wrap: break-word;
        }
    `,
    template: html`
        <permission-prompt
            *if="explainAsk"
            @grant.stop.prevent="grant()"
            message-id="barcodeReader.explainAsk"
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
            <div class="bottom" #ref="bottom">
                <back-button></back-button>
                <div></div>
                <scaling-icon
                    *if="torchAvailable"
                    @click.stop.prevent="toggleTorch()"
                    class="{{torchClass}}"
                    href="/flashlight.svg"
                ></scaling-icon>
            </div>
            <show-modal *if="barcodeFound" @clickoutside="resetFound()">
                <div class="rawValue" @click="resetFound()">
                    <styled-link
                        *if="isUrl"
                        href="{{barcodeFound.rawValue}}"
                        target="_blank"
                        >{{barcodeFound.rawValue}}</styled-link
                    >
                    <span *if="!isUrl"> {{barcodeFound.rawValue}} </span>
                </div>
            </show-modal>
        </div>
    `,
})
export class BarcodeReaderAppComponent {
    private _animationFrame: ReturnType<typeof requestAnimationFrame> | null =
        null;
    private _barcodeReaderService = di(BarcodeReaderService);
    private _subject = new Subject();
    private _torchService = di(TorchService);
    private _urlService = di(UrlService);
    barcodeFound: DetectedBarcode | null = null;
    bottom?: HTMLElement;
    explainAsk = false;
    explainDeny = false;
    explainUnavailable = false;
    isUrl = false;
    showControls = false;
    torchAvailable = false;
    torchClass = '';
    torchEnabled = false;
    video?: HTMLVideoElement;

    onViewInit() {
        this._barcodeReaderService
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
        this._subject.next(null);
        this._subject.complete();
        this._barcodeDetectionStop();
    }

    grant() {
        this._barcodeReaderService.prompt();
    }

    resetFound() {
        this.barcodeFound = null;
        this.isUrl = false;
        this._barcodeDetectionStart();
    }

    toggleTorch() {
        if (this.torchEnabled) {
            this._torchService.turnOff();
        } else {
            this._torchService.turnOn();
        }

        this._setupTorch();
    }

    private _barcodeDetectionStart() {
        const performDetection = () => {
            this._barcodeReaderService.detect(this.video!).then((result) => {
                if (result.length) {
                    this._barcodeDetectionStop();
                    this.barcodeFound = result[0];
                    this.isUrl = this._urlService.isUrl(result[0].rawValue);
                } else {
                    this._animationFrame =
                        requestAnimationFrame(performDetection);
                }
            });
        };

        this._animationFrame = requestAnimationFrame(performDetection);
    }

    private _barcodeDetectionStop() {
        if (this._animationFrame !== null) {
            cancelAnimationFrame(this._animationFrame);
        }
    }

    private _setupTorch() {
        this._torchService.currentStatus().then((enabled) => {
            this.torchEnabled = enabled;
            this.torchClass = enabled ? 'enabled' : '';
        });
    }

    private _startVideoStream() {
        this._barcodeReaderService.getStream().then((stream) => {
            const track = stream.getVideoTracks()[0];

            if (!track) {
                return;
            }

            if (this.video) {
                this.video.srcObject = stream;
                this.video.addEventListener('loadedmetadata', () => {
                    this._barcodeDetectionStart();
                });
            }

            this._setupTorch();
        });
    }
}
