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
import KalmanFilter from '@bencevans/kalman-filter';
import {
    LtDecoder,
    binaryToBlock,
    createDecoder,
    readFileHeaderMetaFromBuffer,
} from 'luby-transform';
import { ScanLoop } from '../services/barcode-reader/scan-loop';
import { Subject } from 'rxjs';
import { di } from '../di';
import { takeUntil } from 'rxjs/operators';
import { toUint8Array } from 'js-base64';

export class FileTransferReceiveAppComponent {
    private _barcodeReaderService = di(BarcodeReaderService);
    private _camera = di(CameraService).controller();
    private _decoder: LtDecoder | null = null;
    private _lastValue = '';
    private _scanLoop = new ScanLoop<DetectedBarcodeData>({
        detect: () =>
            this.video
                ? this._barcodeReaderService.detect(this.video)
                : Promise.resolve([]),
        onResult: (results) => this._onResult(results),
        // QR codes change quickly; scan as fast as possible.
        intervalMs: 0,
    });
    private _subject = new Subject();
    private _track: MediaStreamTrack | null = null;
    checksum: number | null = null;
    data: Uint8Array | null = null;
    decodedCount = 0;
    encodedCount = 0;
    endTime: number | null = null;
    fps: number | null = 0;
    k: number = 0;
    lastFrameTime: number | null = null;
    meta: any;
    screenState = AccessState.CHECKING;
    startTime: number | null = null;
    timeFilter: KalmanFilter | null = null;
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
            const desiredZoom = Math.min(Math.max(1, zoom.min), zoom.max);
            track
                .applyConstraints({ advanced: [{ zoom: desiredZoom } as any] })
                .catch(() => {});
        }

        // Wait a tick for the video element to be rendered.
        setTimeout(() => {
            if (this.video && this._track === track && !this.data) {
                this.video.srcObject = stream;
                this._scanLoop.start();
            }
        });
    }

    private _onResult(results: DetectedBarcodeData[]) {
        const value = results[0].rawValue;

        if (value === this._lastValue) {
            return false;
        }

        this._lastValue = value;

        try {
            if (this._processBarcode(value)) {
                // The whole file arrived. The camera is no longer needed.
                this._camera.release();

                return true;
            }
        } catch (_ignore) {
            // Not one of our QR codes, or a damaged read. Keep going.
        }

        return false;
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
}

component('file-transfer-receive-app', {
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
            border: 1px solid var(--border);
            border-radius: var(--radius-l);
            overflow: hidden;
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
        <access-screen
            *if="screenState !== 'READY' && !data"
            state="{{screenState}}"
            icon="/camera.svg"
            message-id="fileTransfer.receive.explainAsk"
            @grant.stop.prevent="grant()"
        ></access-screen>
        <default-layout *if="screenState === 'READY' || data">
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
            <icon-button
                slot="more-buttons"
                *if="torchAvailable && !data"
                href="/flashlight.svg"
                label-id="shared.torch"
                .active="torchEnabled"
                @click.stop.prevent="toggleTorch()"
            ></icon-button>
        </default-layout>
    `,
}, FileTransferReceiveAppComponent);
