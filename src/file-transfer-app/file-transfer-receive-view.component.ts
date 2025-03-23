import { Component, css, html } from 'fudgel';

// Keep one blob around so it has time to save.
const state = {
    downloadUrl: null as string | null,
};

@Component('file-transfer-receive-view', {
    prop: ['data', 'meta'],
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

        .preview {
            max-width: 100%;
            max-height: 100%;
            border: 1px solid;
            flex-shrink: 1;
            overflow: auto;
            display: flex;
        }

        video,
        audio {
            max-width: 100%;
            max-height: 100%;
            flex-shrink: 1;
        }
    `,
    template: html`
        <div class="wrapper">
            <div *if="contentTypeFirst === 'image'" class="preview">
                <img src="{{downloadUrl}}" />
            </div>
            <div *if="contentTypeFirst === 'video'" class="preview">
                <video controls>
                    <source src="{{downloadUrl}}" type="{{contentType}}" />
                </video>
            </div>
            <div *if="contentTypeFirst === 'audio'" class="preview">
                <audio controls src="{{downloadUrl}}"></audio>
            </div>
            <div *if="contentTypeFirst === 'text'" class="preview">
                <pre>{{text}}</pre>
            </div>
            <a *if="downloadUrl" .href="downloadUrl" download="{{filename}}">
                <i18n-label id="fileTransfer.receive.download"></i18n-label>
                {{ filename }}
            </a>
        </div>
    `,
})
export class FileTransferReceiveViewComponent {
    contentType = 'application/octet-stream';
    contentTypeFirst = 'application';
    data?: Uint8Array<ArrayBufferLike>;
    downloadUrl: string | null = null;
    filename = 'download.dat';
    meta?: any;
    text?: string;

    onChange(propName: string) {
        if (propName === 'meta') {
            this.contentType =
                `${this.meta?.contentType}` || 'application/octet-stream';
            this.contentTypeFirst = this.contentType.split('/')[0];

            if (this.contentTypeFirst === 'text') {
                this.text = new TextDecoder().decode(
                    this.data || new Uint8Array()
                );
            } else {
                this.text = '';
            }

            this.filename = `${this.meta?.filename}` || 'download.dat';
            this._update();
        }

        if (propName === 'data') {
            this._update();
        }
    }

    private _update() {
        this._updateDownloadLink();
    }

    private _updateDownloadLink() {
        if (state.downloadUrl) {
            URL.revokeObjectURL(state.downloadUrl);
        }

        this.downloadUrl = URL.createObjectURL(
            new Blob([this.data || new Uint8Array()], {
                type: this.contentType,
            })
        );
        state.downloadUrl = this.downloadUrl;
    }
}
