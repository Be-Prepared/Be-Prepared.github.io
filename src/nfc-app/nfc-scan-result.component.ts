import { Component, css, html } from 'fudgel';
import { NfcScanResult } from '../services/nfc.service';

@Component('nfc-scan-result', {
    prop: ['scanResult'],
    style: css`
        .breakWord {
            word-wrap: break-word;
        }

        .gapAbove {
            padding-top: 0.3em;
        }
    `,
    template: html`
        <div *if="scanResult && scanResult.ready">
            <i18n-label id="nfc.scanResult.scanning"></i18n-label>
        </div>
        <div *if="scanResult && !scanResult.ready">
            <i18n-label id="nfc.scanResult.timestamp"></i18n-label>
            {{ scanResult.timestamp.toLocaleString() }}
        </div>
        <div *if="scanResult && scanResult.readError">
            <i18n-label id="nfc.scanResult.readError"></i18n-label>
        </div>
        <div *if="scanResult && scanResult.initializeError">
            <i18n-label id="nfc.scanResult.initializeError"></i18n-label>
        </div>
        <div *if="scanResult && scanResult.serialNumber" class="breakWord">
            <i18n-label id="nfc.scanResult.serialNumber"></i18n-label>
            {{ scanResult.serialNumber }}
        </div>
        <div *if="scanResult && scanResult.records">
            <i18n-label id="nfc.scanResult.numberOfRecords"></i18n-label>
            {{ scanResult.records.length }}
        </div>
        <div *if="scanResult && scanResult.records">
            <nfc-record
                *for="record of scanResult.records"
                .record="record"
                class="gapAbove"
            ></nfc-record>
        </div>
    `,
})
export class NfcScanResultComponent {
    scanResult?: NfcScanResult;
}
