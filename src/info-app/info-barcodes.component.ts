import { BarcodeReaderService } from '../services/barcode-reader.service';
import { Component, css, di, html } from 'fudgel';

@Component('info-barcodes', {
    style: css`
    `,
    template: html`
        <info-header id="info.barcodes"></info-header>
        <span *if="barcodes">{{barcodes}}</span>
        <i18n-label *if="!barcodes" id="info.barcodesNotSupported"></i18n-label>
    `,
})
export class InfoBarcodesComponent {
    private _barcodeReaderService = di(BarcodeReaderService);
    barcodes: string | null = '';

    onInit() {
        this._barcodeReaderService.supportedFormats().then((formats) => {
            if (formats.length > 0) {
                this.barcodes = formats.join(', ');
            } else {
                this.barcodes = null;
            }
        });
    }
}
