import { BarcodeReaderService } from '../services/barcode-reader.service';
import { component, css, html } from 'fudgel';
import { di } from '../di';
import { I18nService } from '../i18n/i18n.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export class InfoBarcodesComponent {
    private _barcodeReaderService = di(BarcodeReaderService);
    private _i18nService = di(I18nService);
    private _subject = new Subject();
    active = '';
    fellBack = false;
    nativeFormats = '';
    nativeStatusId = '';
    preference = '';
    zbarFormats = '';

    onInit() {
        this._barcodeReaderService
            .getPreference()
            .pipe(takeUntil(this._subject))
            .subscribe(() => this._update());
    }

    onDestroy() {
        this._subject.next(null);
        this._subject.complete();
    }

    private _update() {
        this._barcodeReaderService.report().then((report) => {
            this.active = this._i18nService.get(
                `barcodeReader.${report.choice.engine}`
            );
            this.preference = `(${this._i18nService.get(
                `barcodeReader.engine.${report.preference}`
            )})`;
            this.fellBack = report.choice.fellBack;
            this.zbarFormats = report.zbarFormats.join(', ');
            this.nativeFormats = (report.native.formats || []).join(', ');

            if (!report.native.available) {
                this.nativeStatusId = 'info.barcodes.nativeMissing';
            } else if (!this.nativeFormats) {
                this.nativeStatusId = 'info.barcodes.nativeEmpty';
            } else {
                this.nativeStatusId = '';
            }
        });
    }
}

component('info-barcodes', {
    style: css`
        dl {
            margin: 0;
        }

        dt {
            font-weight: 600;
            margin-top: var(--space-2);
        }

        dd {
            margin: 0 0 0 var(--space-4);
            overflow-wrap: anywhere;
        }

        .muted {
            color: var(--fg-muted);
        }

        .warning {
            color: var(--warning);
        }
    `,
    template: html`
        <info-header id="info.barcodes"></info-header>
        <dl *if="active">
            <dt><i18n-label id="info.barcodes.inUse" ws=""></i18n-label></dt>
            <dd>
                {{active}}
                <span class="muted">{{preference}}</span>
                <div *if="fellBack" class="warning">
                    <i18n-label
                        id="barcodeReader.engine.nativeUnavailable"
                        ws=""
                    ></i18n-label>
                </div>
            </dd>
            <dt><i18n-label id="barcodeReader.engine.NATIVE" ws=""></i18n-label></dt>
            <dd *if="nativeStatusId" class="muted">
                <i18n-label id="{{nativeStatusId}}" ws=""></i18n-label>
            </dd>
            <dd *if="!nativeStatusId">{{nativeFormats}}</dd>
            <dt><i18n-label id="barcodeReader.engine.Z_BAR" ws=""></i18n-label></dt>
            <dd>{{zbarFormats}}</dd>
        </dl>
    `,
}, InfoBarcodesComponent);
