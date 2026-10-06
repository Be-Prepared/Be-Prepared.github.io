import { AccessState } from '../services/access/access-controller';
import { component, css, html } from 'fudgel';
import { di } from '../di';
import { NfcScanResult, NfcService } from '../services/nfc.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export class NfcAppComponent {
    private _nfc = di(NfcService).controller(
        (result) => (this.lastRead = result)
    );
    private _subject = new Subject();
    lastRead?: NfcScanResult;
    screenState = AccessState.CHECKING;

    onInit() {
        this._nfc.state
            .pipe(takeUntil(this._subject))
            .subscribe((state) => (this.screenState = state));
        this._nfc.init();
    }

    onDestroy() {
        this._subject.next(null);
        this._subject.complete();
        this._nfc.destroy();
    }

    grant() {
        this._nfc.request();
    }
}

component('nfc-app', {
    style: css`
        .enabled {
            color: var(--button-fg-color-enabled);
        }

        .scanning {
            flex-grow: 1;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 2em;
        }
    `,
    template: html`
        <access-screen
            *if="screenState !== 'READY'"
            state="{{screenState}}"
            icon="/nfc.svg"
            message-id="nfc.explainAsk"
            unavailable-id="nfc.unavailable.message"
            error-id="nfc.error"
            @grant.stop.prevent="grant()"
        ></access-screen>
        <default-layout *if="screenState === 'READY'" frame>
            <nfc-scan-result .scan-result="lastRead"></nfc-scan-result>
        </default-layout>
    `,
}, NfcAppComponent);
