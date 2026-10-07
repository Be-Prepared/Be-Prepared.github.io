import { component, css, html } from 'fudgel';

// Keep one blob around so it has time to save.
const state = {
    downloadUrl: null as string | null,
};

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
        const data = this.data ? Uint8Array.from(this.data) : new Uint8Array();

        if (state.downloadUrl) {
            URL.revokeObjectURL(state.downloadUrl);
        }

        this.downloadUrl = URL.createObjectURL(
            new Blob([data], {
                type: this.contentType,
            })
        );
        state.downloadUrl = this.downloadUrl;
    }
}

component('file-transfer-receive-view', {
    prop: ['data', 'meta'],
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

        .preview {
            max-width: 100%;
            min-height: 0;
            flex-shrink: 1;
            overflow: auto;
            display: flex;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-l);
        }

        pre {
            margin: 0;
            padding: var(--space-3);
            font-size: 0.85rem;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
        }

        img,
        video,
        audio {
            max-width: 100%;
            max-height: 100%;
            flex-shrink: 1;
        }

        .download {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.15rem;
            max-width: 100%;
            box-sizing: border-box;
            padding: var(--space-3) var(--space-5);
            color: var(--accent-fg);
            background: var(--accent);
            border-radius: var(--radius-m);
            font-weight: 700;
            text-decoration: none;
            flex-shrink: 0;
        }

        .filename {
            font-weight: 400;
            font-size: 0.9rem;
            overflow-wrap: anywhere;
            text-align: center;
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
            <a
                *if="downloadUrl"
                class="download"
                .href="downloadUrl"
                download="{{filename}}"
            >
                <i18n-label id="fileTransfer.receive.download" ws=""></i18n-label>
                <span class="filename">{{ filename }}</span>
            </a>
        </div>
    `,
}, FileTransferReceiveViewComponent);
