import {
    buildShare,
    SHARE_FORMATS,
    ShareFormatId,
} from './share-formats';
import { component, css, emit, html } from 'fudgel';
import { CoordinateService } from '../services/coordinate.service';
import { di } from '../di';
import { I18nService } from '../i18n/i18n.service';
import { LocalStorageService } from '../services/local-storage.service';
import { ToastService } from '../services/toast.service';

interface FormatOption {
    checked: string;
    className: string;
    description: string;
    id: ShareFormatId;
    title: string;
}

// Remembers which format the person last shared with. A preference, not a
// permission.
const formatStorage = LocalStorageService.list<ShareFormatId>(
    'location.shareFormat',
    SHARE_FORMATS
);

// Lets the person pick how to share a waypoint, because no single link
// works in every map app. Shows a QR code for the choice, plus Share and
// Copy.
export class LocationShareComponent {
    private _coordinateService = di(CoordinateService);
    private _i18nService = di(I18nService);
    private _toastService = di(ToastService);
    canShare = typeof navigator !== 'undefined' && !!navigator.share;
    content = '';
    lat = '';
    lon = '';
    name = '';
    options: FormatOption[] = [];
    selected: ShareFormatId = formatStorage.getItem() || 'be-prepared';

    onChange() {
        this._render();
    }

    close() {
        emit(this, 'close');
    }

    copy() {
        const done = () => this._toastService.popI18n('location.share.copied');

        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(this.content).then(done, () => {});
        }
    }

    select(id: ShareFormatId) {
        this.selected = id;
        formatStorage.setItem(id);
        this._render();
    }

    share() {
        const data: ShareData = { title: this.name || undefined };

        // Only web addresses are reliably accepted as a shared URL. geo:
        // links and text go in the text field.
        if (/^https?:/.test(this.content)) {
            data.url = this.content;
        } else {
            data.text = this.content;
        }

        navigator.share?.(data).catch(() => {});
    }

    private _render() {
        const lat = parseFloat(this.lat);
        const lon = parseFloat(this.lon);

        if (!isFinite(lat) || !isFinite(lon)) {
            return;
        }

        const get = (id: string) => this._i18nService.get(id);
        this.options = SHARE_FORMATS.map((id) => ({
            checked: `${id === this.selected}`,
            className: id === this.selected ? 'format selected' : 'format',
            description: get(`location.share.${id}.description`),
            id,
            title: get(`location.share.${id}`),
        }));
        this.content = buildShare(
            this.selected,
            { lat, lon, name: this.name || '' },
            {
                displayText: this._coordinateService.latLonToSystemString(lat, lon),
                website: __WEBSITE__,
            }
        );
    }
}

component(
    'location-share',
    {
        attr: ['lat', 'lon', 'name'],
        style: css`
            .sheet {
                /* Location screens scale their text up; the sheet doesn't
                   need to. */
                font-size: 1rem;
                display: flex;
                flex-direction: column;
                gap: var(--space-3);
                width: min(30rem, 100%);
                max-height: 100%;
                box-sizing: border-box;
                padding: var(--space-4);
                overflow: auto;
                background: var(--surface);
                color: var(--fg);
                border: 1px solid var(--border);
                border-radius: var(--radius-l);
            }

            h2 {
                margin: 0;
                font-size: 1.25rem;
            }

            .qr {
                align-self: center;
                width: min(60vmin, 16rem);
                aspect-ratio: 1 / 1;
                padding: var(--space-2);
                background: #fff;
                border-radius: var(--radius-m);
                flex-shrink: 0;
            }

            .content {
                font-family: ui-monospace, monospace;
                font-size: 0.8rem;
                overflow-wrap: anywhere;
                white-space: pre-wrap;
                color: var(--fg-muted);
                user-select: text;
            }

            .actions {
                display: flex;
                gap: var(--space-2);
            }

            .actions pretty-button {
                flex: 1;
            }

            .formats {
                display: flex;
                flex-direction: column;
                gap: var(--space-2);
            }

            .format {
                display: flex;
                flex-direction: column;
                gap: 0.15rem;
                padding: var(--space-2) var(--space-3);
                text-align: start;
                font: inherit;
                color: inherit;
                background: var(--surface-2);
                border: 1px solid var(--border);
                border-radius: var(--radius-m);
                cursor: pointer;
            }

            .format.selected {
                border-color: var(--accent);
                box-shadow: 0 0 0 2px var(--accent-soft);
            }

            .format-title {
                font-weight: 700;
            }

            .format-description {
                font-size: 0.85rem;
                color: var(--fg-muted);
            }
        `,
        template: html`
            <div class="sheet" role="dialog">
                <h2><i18n-label id="location.share.heading" ws=""></i18n-label></h2>
                <div class="qr"><qr-code content="{{content}}"></qr-code></div>
                <div class="content">{{content}}</div>
                <div class="actions">
                    <pretty-button
                        *if="canShare"
                        variant="primary"
                        @click.stop.prevent="share()"
                        ><i18n-label id="location.share.share" ws=""></i18n-label
                    ></pretty-button>
                    <pretty-button @click.stop.prevent="copy()"
                        ><i18n-label id="location.share.copy" ws=""></i18n-label
                    ></pretty-button>
                    <pretty-button @click.stop.prevent="close()"
                        ><i18n-label id="location.share.close" ws=""></i18n-label
                    ></pretty-button>
                </div>
                <div class="formats" role="radiogroup">
                    <button
                        *for="option of options"
                        class="{{option.className}}"
                        role="radio"
                        aria-checked="{{option.checked}}"
                        @click.stop.prevent="select(option.id)"
                    >
                        <span class="format-title">{{option.title}}</span>
                        <span class="format-description"
                            >{{option.description}}</span
                        >
                    </button>
                </div>
            </div>
        `,
    },
    LocationShareComponent
);
