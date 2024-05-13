import { Component, css, html } from 'fudgel';

@Component('nfc-record', {
    prop: ['record'],
    style: css`
        :host {
            display: block;
        }

        .data {
            padding: 0 1em;
        }
    `,
    template: html`
        <div *if="record">
            <i18n-label id="nfc.record.recordType"></i18n-label>
            {{ record.recordType }}
        </div>
        <div *if="record && record.mediaType">
            <i18n-label id="nfc.record.mediaType"></i18n-label>
            {{ record.mediaType }}
        </div>
        <div *if="record && record.id">
            <i18n-label id="nfc.record.id"></i18n-label>
            {{ record.id }}
        </div>
        <div *if="record && record.encoding">
            <i18n-label id="nfc.record.encoding"></i18n-label>
            {{ record.encoding }}
        </div>
        <div *if="record && record.lang">
            <i18n-label id="nfc.record.lang"></i18n-label>
            {{ record.lang }}
        </div>
        <div *if="record && record.recordType === 'text'" class="data">
            {{ decode() }}
        </div>
        <div *if="record && record.recordType === 'url'" class="data">
            {{ decode() }}
        </div>
        <div *if="record && record.recordType === 'absolute-url'" class="data">
            {{ decode() }}
        </div>
    `,
})
export class NfcRecordComponent {
    record?: NDEFRecord;

    onChange() {
        console.log(this.record);
    }

    decode() {
        const decoder = new TextDecoder(this.record?.encoding || 'utf-8');

        return decoder.decode(this.record?.data);
    }
}
