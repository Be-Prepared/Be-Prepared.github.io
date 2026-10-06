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

        .range {
            width: 50vw;
        }

        .file-input {
            display: none;
        }

        .full {
            width: 100%;
            height: 100%;
        }
    `,
    template: html`
        <default-layout>
            <div *if="!fileSelected && !fileLoaded" class="wrapper">
                <div class="qr">
                    <label class="full center">
                        <input
                            type="file"
                            class="file-input"
                            @change="selectFile($event.target.files)"
                        />
                        <i18n-label
                            id="fileTransfer.send.selectFile"
                        ></i18n-label>
                    </label>
                </div>
                <div class="controls">
                    <div class="center">
                        <span
                            ><i18n-label
                                id="fileTransfer.send.size"
                            ></i18n-label>
                            {{size}}</span
                        >
                    </div>
                    <input
                        type="range"
                        min="100"
                        max="2800"
                        step="50"
                        value="{{size}}"
                        @change.stop.prevent="sizeChange($event.target.value)"
                        class="range"
                    />
                </div>
            </div>
            <div *if="!fileLoaded && fileSelected" class="wrapper">
                <i18n-label id="fileTransfer.send.loading"></i18n-label>
            </div>
            <div *if="fileLoaded" class="wrapper">
                <div class="qr">
                    <qr-code content="{{qrContent}}"></qr-code>
                </div>
                <div class="controls">
                    <div class="center">
                        <span
                            ><i18n-label
                                id="fileTransfer.send.fps"
                            ></i18n-label>
                            {{fps}}</span
                        >
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="30"
                        step="1"
                        value="{{fps}}"
                        @change.stop.prevent="fpsChange($event.target.value)"
                        class="range"
                    />
                </div>
            </div>
        </default-layout>
    `,
}, FileTransferSendAppComponent);
