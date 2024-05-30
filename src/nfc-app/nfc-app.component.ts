import { AvailabilityState } from '../datatypes/availability-state';
import { Component, css, di, html } from 'fudgel';
import { NfcScanResult, NfcService } from '../services/nfc.service';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component('nfc-app', {
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
        <permission-prompt
            *if="explainAsk"
            @grant.stop.prevent="grant()"
            message-id="nfc.explainAsk"
        ></permission-prompt>
        <permission-denied *if="explainDeny"></permission-denied>
        <camera-unavailable *if="explainUnavailable"></camera-unavailable>
        <default-layout *if="showControls" frame>
            <nfc-scan-result .scan-result="lastRead"></nfc-scan-result>
        </default-layout>
    `,
})
export class NfcAppComponent {
    private _nfcService = di(NfcService);
    private _scanSubscription?: Subscription;
    private _subject = new Subject();
    explainAsk = false;
    explainDeny = false;
    explainUnavailable = false;
    lastRead?: NfcScanResult;
    scanning = false;
    showControls = false;

    onInit() {
        this._nfcService
            .availabilityState()
            .pipe(takeUntil(this._subject))
            .subscribe((value) => {
                this.explainAsk = value === AvailabilityState.PROMPT;
                this.explainDeny = value === AvailabilityState.DENIED;
                this.explainUnavailable =
                    value === AvailabilityState.UNAVAILABLE;
                this.showControls = value === AvailabilityState.ALLOWED;

                if (this.showControls) {
                    this._startScanning();
                } else {
                    this._stopScanning();
                }
            });
    }

    onDestroy() {
        this._subject.next(null);
        this._subject.complete();
    }

    grant() {
        this.explainAsk = false;
        this._nfcService.prompt();
    }

    private _startScanning() {
        if (this.scanning) {
            return;
        }

        this.scanning = true;
        this._scanSubscription = this._nfcService
            .scan()
            .pipe(takeUntil(this._subject))
            .subscribe((event) => {
                this.lastRead = event;
            });
    }

    private _stopScanning() {
        if (!this.scanning) {
            return;
        }

        this.scanning = false;
        this._scanSubscription!.unsubscribe();
    }
}
