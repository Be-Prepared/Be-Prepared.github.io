import { component, css, html } from 'fudgel';
import { crc32, encodeFrame, packFile, splitBlocks } from './frame-format';
import { FountainEncoder } from './fountain';

// Shows the file as an endless stream of QR codes. Every frame combines a
// random set of blocks, chosen by a random seed, so the receiver can start
// watching at any time and miss any frames. See fountain.ts.
export class FileTransferSendAppComponent {
    private _checksum = 0;
    private _encoder: FountainEncoder | null = null;
    private _length = 0;
    private _timeout: ReturnType<typeof setTimeout> | null = null;
    fileLoaded = false;
    fileSelected = false;
    fps = 10;
    qrContent = '';
    // Bytes of the file per QR code. 450 makes about a version 15 code.
    // Version 40, the largest, holds up to 2817.
    size = 450;

    onDestroy() {
        if (this._timeout) {
            clearTimeout(this._timeout);
        }
    }

    fpsChange(n: string) {
        this.fps = +n;
    }

    async selectFile(files?: File[]) {
        if (!files || !files.length) {
            return;
        }

        const file = files[0];
        this.fileSelected = true;
        const container = await packFile(new Uint8Array(await file.arrayBuffer()), {
            contentType: file.type,
            filename: file.name,
        });
        this._checksum = crc32(container);
        this._length = container.length;
        this._encoder = new FountainEncoder(splitBlocks(container, this.size));
        this.fileLoaded = true;
        this._encode();
    }

    sizeChange(n: string) {
        this.size = +n;
    }

    private _encode() {
        const startTime = Date.now();
        const seed = crypto.getRandomValues(new Uint32Array(1))[0];
        this.qrContent = encodeFrame({
            block: this._encoder!.frame(seed),
            checksum: this._checksum,
            length: this._length,
            seed,
        });
        const desiredDuration = 1000 / this.fps;
        this._timeout = setTimeout(
            () => this._encode(),
            Math.max(10, desiredDuration - (Date.now() - startTime))
        );
    }
}

component('file-transfer-send-app', {
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
        }

        @media (orientation: landscape) {
            .wrapper {
                flex-direction: row;
            }
        }

        /* Square, as big as fits. White with its own margin, so the code
           scans in dark mode too. */
        .qr {
            width: min(92vmin, 100%);
            max-height: 100%;
            aspect-ratio: 1 / 1;
            box-sizing: border-box;
            flex-shrink: 1;
            min-height: 0;
            background: #fff;
            border-radius: var(--radius-l);
            overflow: hidden;
        }

        .pick {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: var(--space-3);
            width: min(92vmin, 100%, 24rem);
            aspect-ratio: 1 / 1;
            max-height: 100%;
            min-height: 0;
            box-sizing: border-box;
            font-size: 1.25rem;
            font-weight: 700;
            color: var(--fg);
            background: var(--surface);
            border: 2px dashed var(--border);
            border-radius: var(--radius-l);
            cursor: pointer;
        }

        .pick load-svg {
            width: 3.5rem;
            height: 3.5rem;
            color: var(--accent);
        }

        .file-input {
            display: none;
        }

        .controls {
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
            .controls {
                width: min(40%, 20rem);
            }
        }

        .setting {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            color: var(--fg-muted);
        }

        .value {
            font-size: 1.25rem;
            font-weight: 700;
            font-variant-numeric: tabular-nums;
            color: var(--fg);
        }

        .range {
            width: 100%;
            accent-color: var(--accent);
        }

        .loading {
            color: var(--fg-muted);
        }
    `,
    template: html`
        <default-layout>
            <div *if="!fileSelected && !fileLoaded" class="wrapper">
                <label class="pick">
                    <input
                        type="file"
                        class="file-input"
                        @change="selectFile($event.target.files)"
                    />
                    <load-svg href="/file-transfer.svg"></load-svg>
                    <i18n-label
                        id="fileTransfer.send.selectFile"
                        ws=""
                    ></i18n-label>
                </label>
                <div class="controls">
                    <div class="setting">
                        <i18n-label id="fileTransfer.send.size" ws=""></i18n-label>
                        <span class="value">{{size}}</span>
                    </div>
                    <input
                        type="range"
                        min="100"
                        max="2800"
                        step="50"
                        value="{{size}}"
                        @input.stop.prevent="sizeChange($event.target.value)"
                        @change.stop.prevent="sizeChange($event.target.value)"
                        class="range"
                    />
                </div>
            </div>
            <div *if="!fileLoaded && fileSelected" class="wrapper loading">
                <i18n-label id="fileTransfer.send.loading"></i18n-label>
            </div>
            <div *if="fileLoaded" class="wrapper">
                <div class="qr">
                    <qr-code content="{{qrContent}}"></qr-code>
                </div>
                <div class="controls">
                    <div class="setting">
                        <i18n-label id="fileTransfer.send.fps" ws=""></i18n-label>
                        <span class="value">{{fps}}</span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="30"
                        step="1"
                        value="{{fps}}"
                        @input.stop.prevent="fpsChange($event.target.value)"
                        @change.stop.prevent="fpsChange($event.target.value)"
                        class="range"
                    />
                </div>
            </div>
        </default-layout>
    `,
}, FileTransferSendAppComponent);
