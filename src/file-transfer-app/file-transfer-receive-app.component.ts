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
import { KalmanFilter } from '../util/kalman-filter';
import { crc32, decodeFrame, FileMeta, joinBlocks, unpackFile } from './frame-format';
import { FountainDecoder } from './fountain';
import { ScanLoop } from '../services/barcode-reader/scan-loop';
import { Subject } from 'rxjs';
import { di } from '../di';
import { takeUntil } from 'rxjs/operators';

export class FileTransferReceiveAppComponent {
    private _barcodeReaderService = di(BarcodeReaderService);
    private _camera = di(CameraService).controller({ switchable: true });
    // For the template: names starting with "_" are shortened by the
    // production build, so templates can't use them.
    cameraController = this._camera;
    private _blockSize = 0;
    private _decoder: FountainDecoder | null = null;
    private _length = 0;
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
    failed = false;
    finishing = false;
    endTime: number | null = null;
    fps: number | null = 0;
    k: number = 0;
    lastFrameTime: number | null = null;
    meta: FileMeta | null = null;
    // Percent of the frames needed that have arrived.
    progress = 0;
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

    // Returns true once the whole file has arrived.
    private _processBarcode(text: string) {
        const frame = decodeFrame(text);

        if (
            !this._decoder ||
            this.checksum !== frame.checksum ||
            this._length !== frame.length ||
            this._blockSize !== frame.block.length
        ) {
            // A different file, or the same file with another block size.
            this.checksum = frame.checksum;
            this._length = frame.length;
            this._blockSize = frame.block.length;
            this.k = Math.ceil(frame.length / frame.block.length);
            this._decoder = new FountainDecoder(this.k);
            this.decodedCount = 0;
            this.encodedCount = 0;
            this.progress = 0;
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
        const decoder = this._decoder;
        const done = decoder.add(frame.seed, frame.block);
        this.decodedCount = decoder.decodedCount;
        // Frames held until more blocks are known.
        this.encodedCount = Math.max(0, decoder.receivedCount - decoder.decodedCount);
        // Blocks mostly decode together at the end, so frames received is
        // the honest measure of how far along the transfer is.
        this.progress = Math.min(100, Math.round((decoder.receivedCount / this.k) * 100));

        if (!done) {
            return false;
        }

        // Rebuilding a large file can take a few seconds on a slow phone.
        // Let "Finishing" show first.
        this.finishing = true;
        setTimeout(() => this._finish(decoder), 50);

        return true;
    }

    private _finish(decoder: FountainDecoder) {
        const container = joinBlocks(decoder.blocks(), this._length);

        if (crc32(container) !== this.checksum) {
            // A misread frame got through. Start over.
            this.finishing = false;
            this._decoder = null;
            this._camera.request();

            return;
        }

        unpackFile(container).then(
            ([data, meta]) => {
                this.endTime = Date.now();
                this.finishing = false;
                this.meta = meta;
                this.data = data;
            },
            // The file arrived but this browser can't unpack it (no
            // DecompressionStream, so older than about 2023).
            () => {
                this.finishing = false;
                this.failed = true;
            }
        );
    }
}

component('file-transfer-receive-app', {
    style: css`
        .wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: var(--space-4);
            height: 100%;
            width: 100%;
            box-sizing: border-box;
            padding: var(--space-4);
            overflow: hidden;
            text-align: center;
        }

        @media (orientation: landscape) {
            .wrapper {
                flex-direction: row;
            }
        }

        .qr {
            width: min(92vmin, 100%);
            max-height: 100%;
            min-height: 0;
            flex-shrink: 1;
            aspect-ratio: 1 / 1;
            box-sizing: border-box;
            border: 1px solid var(--border);
            border-radius: var(--radius-l);
            overflow: hidden;
        }

        video {
            height: 100%;
            width: 100%;
            object-fit: cover;
            touch-action: none;
        }

        .status {
            display: flex;
            flex-direction: column;
            gap: var(--space-2);
            width: min(100%, 24rem);
            box-sizing: border-box;
            padding: var(--space-3) var(--space-4);
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-l);
            flex-shrink: 0;
        }

        @media (orientation: landscape) {
            .status {
                width: min(40%, 20rem);
            }
        }

        .bar {
            width: 100%;
            height: 0.5rem;
            accent-color: var(--accent);
        }

        .center {
            font-variant-numeric: tabular-nums;
            color: var(--fg-muted);
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
            <div *if="failed" class="wrapper">
                <i18n-label id="fileTransfer.receive.failed"></i18n-label>
            </div>
            <div *if="finishing" class="wrapper">
                <i18n-label id="fileTransfer.receive.finishing"></i18n-label>
            </div>
            <div *if="!data && !failed && !finishing" class="wrapper">
                <div class="qr">
                    <video #ref="video" autoplay muted playsinline></video>
                </div>
                <div class="status">
                    <progress class="bar" max="100" value="{{progress}}"></progress>
                    <div class="center">
                        {{ decodedCount }} / {{ k }} (+ {{ encodedCount }}) @
                        {{ fps }}&nbsp;<i18n-label
                            id="fileTransfer.receive.fps"
                        ></i18n-label>
                    </div>
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
            <camera-switch
                slot="more-buttons"
                .camera="cameraController"
            ></camera-switch>
        </default-layout>
    `,
}, FileTransferReceiveAppComponent);
