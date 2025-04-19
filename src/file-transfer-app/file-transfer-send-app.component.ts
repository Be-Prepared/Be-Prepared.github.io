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
    _indices: number[] = [];
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
        this._probabilities = this._getProbabilities(this._encoder.k);
        this._encode();
    }

    sizeChange(n: string) {
        this.size = +n;
    }

    private _encode() {
        const startTime = Date.now();
        const degree = this._getDegree(this._encoder!.k);

        // Get up to 8 indices.
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
        // up to 2100 bytes in case the URL needs to change.
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

    private _getDegree(k: number) {
        const r = Math.random();

        for (let i = 0; i < this._probabilities.length && i < k; i += 1) {
            if (r <= this._probabilities[i]) {
                return i + 1;
            }
        }

        return k;
    }

    private _getIndices(k: number, degree: number) {
        // I dislike random indices because there's no guarantee that a block
        // will be picked. One index will always cycle through all blocks.
        const indices = new Set<number>();

        if (!this._indices.length) {
            this._indices = Array.from({ length: k }, (_, i) => i);

            for (let i = 0; i < k; i += 1) {
                const j = Math.floor(Math.random() * k);
                const t = this._indices[i];
                this._indices[i] = this._indices[j];
                this._indices[j] = t;
            }
        }

        indices.add(this._indices.pop()!);

        while (indices.size < degree) {
            indices.add(Math.floor(Math.random() * k));
        }

        return Array.from(indices);
    }

    // Uses a robust soliton distribution, modified to have at most 16 blocks
    // transferred so the data will fit into a QR code.
    private _getProbabilities(k: number) {
        // These affect the shape of the distribution.
        const c = 0.04;
        const d = 0.01; // Failure probability
        const r = c * Math.sqrt(k) * Math.log(k / d);

        // Constrain R so K/R is at most 16.
        const r16 = Math.min(k / 16, Math.floor(r));
        const threshold = Math.floor(k / r16);
        let total = 0;
        const probabilities = [];

        for (let i = 1; i <= 16; i += 1) {
            let tao = r / (k * i);

            if (i === threshold) {
                tao = r16 * Math.log(r16 / d) / (k);
            }

            let rho = 1 / (i * (i - 1));

            if (i === 1) {
                rho = 1 / (k);
            }

            const sum = tao + rho;
            probabilities.push(sum);
            total += sum;
        }

        // Fix scaling
        let accumulated = 0;
        for (let i = 0; i < probabilities.length; i += 1) {
            accumulated += (probabilities[i] / total);
            probabilities[i] = accumulated;
        }

        // Guarantee no more than 16 and that there's no slim chance due to
        // imprecise math that we'd miss a probability.
        probabilities[15] = 1

        if (k < 16) {
            probabilities[k - 1] = 1;
        }

        return probabilities;
    }
}
