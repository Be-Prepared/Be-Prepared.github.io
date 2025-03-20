import { AvailabilityState } from '../datatypes/availability-state';
import { BarcodeReaderService } from '../services/barcode-reader.service';
import { Component, css, html } from 'fudgel';
import KalmanFilter from '@bencevans/kalman-filter';
import {
    LtDecoder,
    binaryToBlock,
    createDecoder,
    readFileHeaderMetaFromBuffer,
} from 'luby-transform';
import { Subject } from 'rxjs';
import { TorchService } from '../services/torch.service';
import { di } from '../di';
import { takeUntil } from 'rxjs/operators';
import { toUint8Array } from 'js-base64';

@Component('file-transfer-receive-app', {
    style: css`
        .wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-evenly;
            height: 100%;
            width: 100%;
            overflow: hidden;
        }

        @media (orientation: landscape) {
            .wrapper {
                flex-direction: row;
            }
        }

        .qr {
            max-height: 95vmin;
            max-width: 95vmin;
            flex-grow: 1;
            aspect-ratio: 1/1;
            box-sizing: border-box;
            margin: 2em;
            border: 1px solid;
        }

        .center {
            display: flex;
            justify-content: center;
            align-items: center;
        }

        video {
            height: 100%;
            width: 100%;
            object-fit: cover;
            touch-action: none;
        }
    `,
    template: html`
        <permission-prompt
            *if="explainAsk"
            @grant.stop.prevent="grant()"
            message-id="fileTransfer.receive.explainAsk"
        ></permission-prompt>
        <permission-denied *if="explainDeny"></permission-denied>
        <camera-unavailable *if="explainUnavailable"></camera-unavailable>
        <default-layout *if="showControls">
            <div *if="!data" class="wrapper">
                <div class="qr">
                    <video #ref="video" autoplay muted playsinline></video>
                </div>
                <div class="center">
                    {{ decodedCount }} / {{ k }} (+ {{ encodedCount }}) @ {{ fps
                    }}&nbsp;<i18n-label id="fileTransfer.receive.fps"></i18n-label>
                </div>
            </div>
            <file-transfer-receive-view
                *if="data"
                .data="data"
                .meta="meta"
            ></file-transfer-receive-view>
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
export class FileTransferReceiveAppComponent {
    private _animationFrame: ReturnType<typeof requestAnimationFrame> | null =
        null;
    private _barcodeReaderService = di(BarcodeReaderService);
    private _decoder: LtDecoder | null = null;
    private _subject = new Subject();
    private _torchService = di(TorchService);
    checksum: number | null = null;
    data: Uint8Array | null = null;
    decodedCount = 0;
    encodedCount = 0;
    endTime: number | null = null;
    explainAsk = false;
    explainDeny = false;
    explainUnavailable = false;
    fps: number | null = 0;
    k: number = 0;
    lastFrameTime: number | null = null;
    meta: any;
    showControls = false;
    startTime: number | null = null;
    timeFilter: KalmanFilter | null = null;
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

    toggleTorch() {
        if (this.torchEnabled) {
            this._torchService.turnOff();
        } else {
            this._torchService.turnOn();
        }

        this._setupTorch();
    }

    private _barcodeDetectionStart() {
        let last = '';

        const performDetection = () => {
            this._barcodeReaderService.detect(this.video!).then((result) => {
                if (result.length && result[0].rawValue !== last) {
                    last = result[0].rawValue;
                    const stop = this._processBarcode(result[0].rawValue);

                    if (stop) {
                        return;
                    }
                }

                this._animationFrame = requestAnimationFrame(performDetection);
            });
        };

        this._animationFrame = requestAnimationFrame(performDetection);
    }

    private _barcodeDetectionStop() {
        if (this._animationFrame !== null) {
            cancelAnimationFrame(this._animationFrame);
        }
    }

    private _processBarcode(strData: string) {
        if (strData.startsWith('http')) {
            strData = strData.slice(strData.indexOf('#') + 1);
        }

        const binary = toUint8Array(strData);
        const data = binaryToBlock(binary);

        if (this.checksum !== data.checksum || this.k !== data.k) {
            // RESET
            this.checksum = data.checksum;
            this.k = data.k;
            this._decoder = createDecoder();
            this.decodedCount = 0;
            this.encodedCount = 0;
            this.fps = null;
            this.startTime = Date.now();
            this.timeFilter = new KalmanFilter({
                initialEstimate: 500,
                initialErrorInEstimate: 500,
            });
            this.lastFrameTime = null;
        }

        if (this.lastFrameTime) {
            const x = this.timeFilter!.update({
                measurement: Date.now() - this.lastFrameTime,
                errorInMeasurement: 1,
            });
            const [estimate] = x;
            this.fps = Math.round(1000 / estimate * 100) / 100;
        }

        this.lastFrameTime = Date.now();
        const success = this._decoder!.addBlock(data);
        this.decodedCount = this._decoder!.decodedCount;
        this.encodedCount = this._decoder!.encodedCount;

        if (success) {
            const merged = this._decoder!.getDecoded()!;
            const [data, meta] = readFileHeaderMetaFromBuffer(merged);
            this.endTime = Date.now();
            this.data = data;
            this.meta = meta;
        }

        return success;
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
