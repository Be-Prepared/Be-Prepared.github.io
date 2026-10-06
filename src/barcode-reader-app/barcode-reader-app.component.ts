import { AccessState } from '../services/access/access-controller';
import { BarcodeReaderService } from '../services/barcode-reader.service';
import {
    CameraService,
    getVideoTrack,
    hasTorch,
    isTorchOn,
    setTorch,
} from '../services/camera.service';
import { component, css, html } from 'fudgel';
import { DetectedBarcodeData } from '../services/barcode-reader/barcode-reader-interface';
import { di } from '../di';
import { ScanLoop } from '../services/barcode-reader/scan-loop';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { UrlService } from '../services/url.service';

// After dismissing a result, the same code is very likely still in front of
// the camera. Ignore it for a moment so the result doesn't pop right back up.
const IGNORE_SAME_CODE_MS = 2000;

export class BarcodeReaderAppComponent {
    private _barcodeReaderService = di(BarcodeReaderService);
    private _camera = di(CameraService).controller();
    private _ignoreUntil = 0;
    private _ignoreValue: string | null = null;
    private _scanLoop = new ScanLoop<DetectedBarcodeData>({
        detect: () =>
            this.video
                ? this._barcodeReaderService.detect(this.video)
                : Promise.resolve([]),
        onResult: (results) => this._found(results),
    });
    private _subject = new Subject();
    private _track: MediaStreamTrack | null = null;
    private _urlService = di(UrlService);
    barcodeFound: DetectedBarcodeData | null = null;
    isUrl = false;
    screenState = AccessState.CHECKING;
    torchAvailable = false;
    torchEnabled = false;
    video?: HTMLVideoElement;

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
        this._scanLoop.stop();
        this._camera.destroy();
    }

    grant() {
        this._camera.request();
    }

    resetFound() {
        if (this.barcodeFound) {
            this._ignoreValue = this.barcodeFound.rawValue;
            this._ignoreUntil = Date.now() + IGNORE_SAME_CODE_MS;
        }

        this.barcodeFound = null;
        this.isUrl = false;

        if (this._track) {
            this._scanLoop.start();
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
        this._track = track;
        this.torchAvailable = hasTorch(track);
        this.torchEnabled = isTorchOn(track);

        if (!track) {
            this._scanLoop.stop();

            return;
        }

        const zoom = (track.getCapabilities?.() as any)?.zoom;

        if (zoom) {
            // Some phones start zoomed out on a wide angle lens, which makes
            // barcodes too small to read.
            const desiredZoom = Math.min(Math.max(1, zoom.min), zoom.max);
            track
                .applyConstraints({ advanced: [{ zoom: desiredZoom } as any] })
                .catch(() => {});
        }

        // Wait a tick for the video element to be rendered.
        setTimeout(() => {
            if (this.video && this._track === track) {
                this.video.srcObject = stream;

                if (!this.barcodeFound) {
                    // Detection returns nothing until frames arrive, so it's
                    // safe to start right away.
                    this._scanLoop.start();
                }
            }
        });
    }

    private _found(results: DetectedBarcodeData[]) {
        const now = Date.now();
        const result = results.find(
            (item) =>
                item.rawValue !== this._ignoreValue || now >= this._ignoreUntil
        );

        if (!result) {
            return false;
        }

        this._ignoreValue = null;
        this.barcodeFound = result;
        this.isUrl = this._urlService.isUrl(result.rawValue);

        if (navigator.vibrate) {
            try {
                navigator.vibrate(50);
            } catch (_ignore) {}
        }

        return true;
    }
}

component(
    'barcode-reader-app',
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
                overflow: hidden;
                background: #000;
                z-index: 0;
            }

            video {
                height: 100%;
                width: 100%;
                object-fit: cover;
            }

            .target {
                position: absolute;
                top: 50%;
                left: 50%;
                width: min(70vw, 70vh, 22rem);
                aspect-ratio: 1 / 1;
                transform: translate(-50%, -50%);
                border-radius: var(--radius-l);
                box-shadow: 0 0 0 100vmax rgba(0, 0, 0, 0.35);
                outline: 3px solid rgba(255, 255, 255, 0.85);
                pointer-events: none;
            }

            .result {
                background-color: var(--bg);
                color: var(--fg);
                padding: var(--space-4);
                border-radius: var(--radius-l);
                font-size: 1.25rem;
                word-wrap: break-word;
                overflow-wrap: anywhere;
                box-sizing: border-box;
                max-width: 100%;
                max-height: 70vh;
                overflow: auto;
                user-select: text;
            }

            .format {
                font-size: 0.8rem;
                color: var(--fg-muted);
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin-bottom: var(--space-2);
            }

            .actions {
                margin-top: var(--space-3);
            }
        `,
        template: html`
            <access-screen
                *if="screenState !== 'READY'"
                state="{{screenState}}"
                icon="/camera.svg"
                message-id="barcodeReader.explainAsk"
                @grant.stop.prevent="grant()"
            ></access-screen>
            <div *if="screenState === 'READY'" class="viewport">
                <video #ref="video" autoplay muted playsinline></video>
                <div class="target"></div>
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
            </default-layout>
            <show-modal *if="barcodeFound" @clickoutside="resetFound()">
                <div class="result">
                    <div class="format">{{barcodeFound.format}}</div>
                    <styled-link
                        *if="isUrl"
                        href="{{barcodeFound.rawValue}}"
                        target="_blank"
                        >{{barcodeFound.rawValue}}</styled-link
                    >
                    <span *if="!isUrl">{{barcodeFound.rawValue}}</span>
                    <div class="actions">
                        <pretty-button
                            variant="primary"
                            @click.stop.prevent="resetFound()"
                            ><i18n-label
                                id="barcodeReader.scanAgain"
                                ws=""
                            ></i18n-label
                        ></pretty-button>
                    </div>
                </div>
            </show-modal>
        `,
    },
    BarcodeReaderAppComponent
);
