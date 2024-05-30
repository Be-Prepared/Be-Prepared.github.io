import { BarcodeReaderService } from '../services/barcode-reader.service';
import { Component, css, di, html } from 'fudgel';
import { I18nService } from '../i18n/i18n.service';

@Component('info-barcodes', {
    style: css``,
    template: html`
        <info-header id="info.barcodes"></info-header>
        <span *if="barcodes">{{type}}: {{barcodes}}</span>
        <i18n-label *if="!barcodes" id="info.barcodesNotSupported"></i18n-label>
    `,
})
export class InfoBarcodesComponent {
    private _barcodeReaderService = di(BarcodeReaderService);
    private _i18nService = di(I18nService);
    barcodes: string | null = '';
    type: string = 'Unknown';

    onInit() {
        this._barcodeReaderService.type().then((type) => {
            this.type = this._i18nService.get(`barcodeReader.${type}`);
        });
        this._barcodeReaderService.supportedFormats().then((formats) => {
            if (formats.length > 0) {
                this.barcodes = formats.join(', ');
            } else {
                this.barcodes = null;
            }
        });
    }
}
