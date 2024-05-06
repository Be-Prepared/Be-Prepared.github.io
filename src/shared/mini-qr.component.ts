import { Component, css, di, html } from 'fudgel';
import { QrService } from '../services/qr.service';

@Component('mini-qr', {
    attr: ['content'],
    style: css`
        :host {
            position: relative;
            display: block;
        }

        .miniSvg {
            width: 4em;
            height: 4em;
        }

        .qrOuter {
            position: absolute;
            inset: 0;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .qrInner {
            background-color: white;
            color: black;
            padding: 0.25em;
        }
    `,
    template: html`
        <div #ref="miniSvg" class="miniSvg"></div>
        <div class="qrOuter">
            <div class="qrInner">
                <i18n-label id="shared.miniQr.qr"></i18n-label>
            </div>
        </div>
    `,
})
export class MiniQrComponent {
    _qrService = di(QrService);
    content = '';
    miniSvg?: HTMLButtonElement;

    onViewInit() {
        if (this.miniSvg) {
            this.miniSvg.innerHTML = this._qrService.svg(this.content || '');
        }
    }
}
