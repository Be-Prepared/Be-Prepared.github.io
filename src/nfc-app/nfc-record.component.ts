import { component, css, html } from 'fudgel';
import { NfcDecodedRecord, NfcKind, pickTitle } from './nfc-decode';

// Friendly names for record types that aren't self-explanatory.
const TYPE_NAMES: { [recordType: string]: string } = {
    ':act': 'nfc.record.type.action',
    ':s': 'nfc.record.type.size',
    ':t': 'nfc.record.type.type',
    'smart-poster': 'nfc.record.type.smartPoster',
};

// One decoded record. Records that contain other records (smart posters,
// some external types) show them indented below, using this component
// again.
export class NfcRecordComponent {
    actionId = '';
    hasDetails = false;
    hasSize = false;
    isEmpty = false;
    isImage = false;
    isLink = false;
    isNested = false;
    record?: NfcDecodedRecord;
    showText = false;
    title = '';
    typeNameId = '';

    onChange() {
        const record = this.record;

        if (!record) {
            return;
        }

        this.typeNameId = TYPE_NAMES[record.recordType] || '';
        this.actionId = record.action ? `nfc.record.action.${record.action}` : '';
        this.isEmpty = record.kind === NfcKind.EMPTY;
        this.isImage = record.kind === NfcKind.IMAGE;
        this.isLink = record.kind === NfcKind.URL;
        this.isNested = record.kind === NfcKind.NESTED;
        this.hasDetails = record.kind === NfcKind.MIME || this.isImage;
        this.hasSize = typeof record.size === 'number';
        this.showText = !this.isLink && !!record.text;
        this.title =
            (record.recordType === 'smart-poster' &&
                pickTitle(record, navigator.languages || [])) ||
            '';
    }
}

component('nfc-record', {
    prop: ['record'],
    style: css`
        :host {
            display: block;
        }

        .record {
            overflow-wrap: anywhere;
            padding: var(--space-2) 0;
        }

        .type {
            font-size: 0.8em;
            font-weight: 700;
            letter-spacing: 0.04em;
            color: var(--fg-muted);
        }

        .raw-type {
            font-weight: 400;
            font-family: ui-monospace, monospace;
        }

        .meta {
            font-size: 0.85em;
            color: var(--fg-muted);
        }

        .title {
            font-weight: 700;
            font-size: 1.1em;
        }

        .data {
            padding: var(--space-1) 0 0 var(--space-3);
            white-space: pre-wrap;
        }

        .hex {
            font-family: ui-monospace, monospace;
            font-size: 0.85em;
        }

        img {
            display: block;
            max-width: 100%;
            max-height: 12rem;
            margin-top: var(--space-1);
            border-radius: var(--radius-s);
            background: var(--surface-2);
        }

        .children {
            margin: var(--space-1) 0 0 var(--space-2);
            padding-left: var(--space-3);
            border-left: 3px solid var(--accent-soft);
        }
    `,
    template: html`
        <div *if="record" class="record">
            <div class="type">
                <i18n-label *if="typeNameId" id="{{typeNameId}}"></i18n-label>
                <span class="raw-type">{{record.recordType}}</span>
            </div>
            <div *if="title" class="title">{{title}}</div>
            <div *if="record.mediaType" class="meta">
                <i18n-label id="nfc.record.mediaType"></i18n-label>
                {{record.mediaType}}
            </div>
            <div *if="record.id" class="meta">
                <i18n-label id="nfc.record.id"></i18n-label>
                {{record.id}}
            </div>
            <div *if="record.lang" class="meta">
                <i18n-label id="nfc.record.lang"></i18n-label>
                {{record.lang}}
            </div>
            <div *if="record.encoding" class="meta">
                <i18n-label id="nfc.record.encoding"></i18n-label>
                {{record.encoding}}
            </div>
            <div *if="hasDetails" class="meta">
                <i18n-label id="nfc.record.dataSize"></i18n-label>
                {{record.byteLength}}
                <i18n-label id="nfc.record.bytes"></i18n-label>
            </div>
            <div *if="isLink" class="data">
                <styled-link href="{{record.url}}" target="_blank"
                    >{{record.url}}</styled-link
                >
            </div>
            <div *if="showText" class="data">{{record.text}}</div>
            <div *if="actionId" class="data">
                <i18n-label id="{{actionId}}"></i18n-label>
            </div>
            <div *if="hasSize" class="data">
                {{record.size}}
                <i18n-label id="nfc.record.bytes"></i18n-label>
            </div>
            <div *if="isImage" class="data">
                <img src="{{record.imageSrc}}" alt="{{record.mediaType}}" />
            </div>
            <div *if="record.hex" class="data hex">{{record.hex}}</div>
            <div *if="isEmpty" class="data meta">
                <i18n-label id="nfc.record.empty"></i18n-label>
            </div>
            <div *if="isNested" class="children">
                <nfc-record
                    *for="child of record.children"
                    .record="child"
                ></nfc-record>
            </div>
        </div>
    `,
}, NfcRecordComponent);
