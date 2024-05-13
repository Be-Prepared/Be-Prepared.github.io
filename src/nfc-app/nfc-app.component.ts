import { AvailabilityState } from '../datatypes/availability-state';
import { Component, css, di, html } from 'fudgel';
import { NfcScanResult, NfcService } from '../services/nfc.service';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component('nfc-app', {
    style: css`
        :host {
            display: flex;
            flex-direction: column;
            font-size: 1.2em;
            height: 100%;
            width: 100%;
            box-sizing: border-box;
        }

        .wrapper {
            padding: 1em;
            height: 100%;
            width: 100%;
            overflow: hidden;
            display: flex;
            box-sizing: border-box;
        }

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

        .wrapperInner {
            flex-grow: 1;
            padding: 0.3em;
            border-style: solid;
            box-sizing: border-box;
            border-width: 1px;
            overflow-x: auto;
            height: 100%;
            width: 100%;
        }

        @media (orientation: landscape) {
            :host,
            .wrapper {
                flex-direction: row-reverse;
            }

            .buttons {
                flex-direction: column-reverse;
            }
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
        <div *if="showControls" class="wrapper">
            <div class="wrapperInner">
                <nfc-scan-result .scan-result="lastRead"></nfc-scan-result>
            </div>
        </div>
        <div *if="showControls">
            <back-button></back-button>
        </div>
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
