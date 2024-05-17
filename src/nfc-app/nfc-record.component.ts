import { Component, css, html } from 'fudgel';

@Component('nfc-record', {
    prop: ['record'],
    style: css`
        :host {
            display: block;
        }

        .breakWord {
            word-break: break-word;
        }

        .data {
            padding: 0 1em;
        }
    `,
    template: html`
        <div *if="record" class="breakWord">
            <i18n-label id="nfc.record.recordType"></i18n-label>
            {{ record.recordType }}
        </div>
        <div *if="record && record.mediaType" class="breakWord">
            <i18n-label id="nfc.record.mediaType"></i18n-label>
            {{ record.mediaType }}
        </div>
        <div *if="record && record.id" class="breakWord">
            <i18n-label id="nfc.record.id"></i18n-label>
            {{ record.id }}
        </div>
        <div *if="record && record.encoding" class="breakWord">
            <i18n-label id="nfc.record.encoding"></i18n-label>
            {{ record.encoding }}
        </div>
        <div *if="record && record.lang" class="breakWord">
            <i18n-label id="nfc.record.lang"></i18n-label>
            {{ record.lang }}
        </div>
        <div *if="record && record.recordType === 'text'" class="data breakWord">
            {{ decode() }}
        </div>
        <div *if="record && record.recordType === 'url'" class="data breakWord">
            <styled-link href="{{ decode() }}" target="_blank">{{ decode() }}</styled-link>
        </div>
        <div *if="record && record.recordType === 'absolute-url'" class="data breakWord">
            <styled-link href="{{ decode() }}" target="_blank">{{ decode() }}</styled-link>
        </div>
    `,
})
export class NfcRecordComponent {
    record?: NDEFRecord;

    decode() {
        const decoder = new TextDecoder(this.record?.encoding || 'utf-8');

        return decoder.decode(this.record?.data);
    }
}
