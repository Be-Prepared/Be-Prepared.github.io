import { Component, css, html } from 'fudgel';
import {
    appendFileHeaderMetaToBuffer,
    blockToBinary,
    createEncoder,
    LtEncoder,
} from 'luby-transform';
import { fromUint8Array } from 'js-base64';

@Component('file-transfer-send-app', {
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
                        max="2100"
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
})
export class FileTransferSendAppComponent {
    _encoder: LtEncoder | null = null;
    _probabilities: number[] = [1];
    _timeout: ReturnType<typeof setTimeout> | null = null;
    contentType = '';
    fileLoaded = false;
    filename = '';
    fileSelected = false;
    fps = 10;
    qrContent = '';
    size = 300;

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
        this.filename = file.name;
        this.contentType = file.type;
        const buffer = await file.arrayBuffer();
        const data = appendFileHeaderMetaToBuffer(new Uint8Array(buffer), {
            filename: this.filename,
            contentType: this.contentType,
        });
        this.fileLoaded = true;
        this._encoder = createEncoder(data, this.size);
        this._encode();
    }

    sizeChange(n: string) {
        this.size = +n;
    }

    private _encode() {
        const startTime = Date.now();
        const degree = this._getDegree(this._encoder!.k);
        const indices = this._getIndices(this._encoder!.k, degree);

        // Build a block from the indices.
        const block = this._encoder!.createBlock(indices);

        // Convert the block to numbers.
        // 4 bytes for number of indices
        // 4n bytes for indices (4 bytes per index).
        // 4 bytes for the total number of blocks.
        // 4 bytes for the number of bytes in the payload
        // 4 bytes for a checksum of the whole file.
        // So, the maximum is 16 indices in this implementation, which
        // means 4 + 4*16 + 4 + 4 + 4 bytes (80 bytes) max for block header,
        // leaving 2110 (max) bytes for the block data and the UI allows blocks
        // up to 2100 bytes in case the URL need a minor change.
        const binary = blockToBinary(block);

        // Base64 encoding changes 3 bytes to 4 characters
        // 2190 bytes will fit into 2921 characters.
        const base64 = fromUint8Array(binary);

        // Max size for QR code content is 2953 bytes
        // URL prefix is 32 bytes. 2921 bytes remain for content.
        this.qrContent = `https://be-prepared.github.io/r#${base64}`;
        const endTime = Date.now();
        const desiredDuration = 1000 / this.fps;
        this._timeout = setTimeout(
            () => this._encode(),
            Math.max(10, desiredDuration - (endTime - startTime))
        );
    }

    /**
     * This returns the number of source blocks to combine into
     * an encoded block.
     *
     * See README.md for details about the distribution.
     */
    private _getDegree(k: number) {
        const r = Math.random();

        if (r < 0.020408) {
            return 1;
        }

        if (r < 0.673469) {
            return Math.min(2, k);
        }

        if (r < 0.836734) {
            return Math.min(8, k);
        }

        return Math.min(16, k);
    }

    // In practice, forcing a specific index to get picked for each block
    // doesn't seem to have a positive or negative effect when some blocks are
    // lost during transmission.
    private _getIndices(k: number, degree: number) {
        const indices = new Set<number>();

        while (indices.size < degree) {
            indices.add(Math.floor(Math.random() * k));
        }

        return Array.from(indices);
    }
}
