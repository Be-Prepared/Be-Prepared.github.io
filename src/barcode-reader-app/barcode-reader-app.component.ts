import { AvailabilityState } from '../datatypes/availability-state';
import { BarcodeReaderService } from '../services/barcode-reader.service';
import { Component, css, di, html } from 'fudgel';
import { DetectedBarcodeData } from '../services/barcode-reader/barcode-reader-interface';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TorchService } from '../services/torch.service';
import { UrlService } from '../services/url.service';

@Component('barcode-reader-app', {
    style: css`
        :host,
        .wrapper {
            height: 100%;
            width: 100%;
        }

        video {
            height: 100%;
            width: 100%;
            object-fit: cover;
            touch-action: none;
        }

        .enabled {
            color: var(--button-fg-color-enabled);
        }

        .raw-value {
            background-color: var(--bg-color);
            padding: 1em;
            border-radius: 0.5em;
            font-size: 1.4em;
            word-wrap: break-word;
            box-sizing: border-box;
            max-width: 100%;
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
            <video #ref="video" autoplay muted playsinline></video>
            <default-layout>
                <scaling-icon
                    slot="more-buttons"
                    *if="torchAvailable"
                    @click.stop.prevent="toggleTorch()"
                    class="{{torchClass}}"
                    href="/flashlight.svg"
                ></scaling-icon>
            </default-layout>
            <show-modal *if="barcodeFound" @clickoutside="resetFound()">
                <div class="raw-value" @click="resetFound()">
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
    barcodeFound: DetectedBarcodeData | null = null;
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
        this.explainAsk = false;
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

            const zoom = (track.getCapabilities() as any).zoom;

            if (zoom) {
                const desiredZoom = Math.min(Math.max(1, zoom.min), zoom.max);
                track.applyConstraints({
                    advanced: [
                        {
                            zoom: desiredZoom,
                        } as any,
                    ],
                });
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
