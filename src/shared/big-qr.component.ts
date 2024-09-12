import { Component, css, html } from 'fudgel';
import { di } from '../di';
import { QrService } from '../services/qr.service';

@Component('big-qr', {
    attr: ['content'],
    style: css`
        :host {
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .svg {
            width: 90vmin;
            height: 90vmin;
        }
    `,
    template: html` <div class="svg" #ref="svg"></div> `,
})
export class BigQrComponent {
    _qrService = di(QrService);
    content = '';
    svg?: HTMLDivElement;

    onViewInit() {
        if (this.svg) {
            this.svg.innerHTML = this._qrService.svg(this.content || '');
        }
    }
}
