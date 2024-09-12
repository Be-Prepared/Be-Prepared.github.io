import { AvailabilityState } from '../datatypes/availability-state';
import { CompassService } from '../services/compass.service';
import { Component, css, html } from 'fudgel';
import { di } from '../di';
import { GeolocationService } from '../services/geolocation.service';
import { NfcService } from '../services/nfc.service';
import { Subject } from 'rxjs';
import { WakeLockService } from '../services/wake-lock.service';
import { takeUntil } from 'rxjs/operators';
import { TorchService } from '../services/torch.service';

@Component('info-permissions', {
    style: css``,
    template: html`
        <info-header id="info.permissionsAndFeaturesHeader"></info-header>
        <ul>
            <li>
                <i18n-label id="info.camera"></i18n-label>
                <info-app-permission permission="camera"></info-app-permission>
            </li>
            <li>
                <i18n-label id="info.compass"></i18n-label>
                (<i18n-label
                    id="info.compass.{{ compassType }}"
                    ws=""
                ></i18n-label
                >)
                <info-app-availability
                    .availability-state="compass"
                ></info-app-availability>
            </li>
            <li>
                <i18n-label id="info.geolocation"></i18n-label>
                <info-app-availability
                    .availability-state="geolocation"
                ></info-app-availability>
            </li>
            <li>
                <i18n-label id="info.nfc"></i18n-label>
                <info-app-availability
                    .availability-state="nfc"
                ></info-app-availability>
            </li>
            <li>
                <i18n-label id="info.torch"></i18n-label>
                <info-app-availability
                    .availability-state="torch"
                ></info-app-availability>
            </li>
            <li>
                <i18n-label id="info.wakeLock"></i18n-label>
                <info-app-availability
                    .availability-state="wakeLock"
                ></info-app-availability>
            </li>
        </ul>
    `,
})
export class InfoPermissionsComponent {
    private _compassService = di(CompassService);
    private _geolocationService = di(GeolocationService);
    private _nfcService = di(NfcService);
    private _subject = new Subject();
    private _torchService = di(TorchService);
    private _wakeLockService = di(WakeLockService);
    compass = AvailabilityState.ERROR;
    compassType = 'ABSOLUTE_ORIENTATION_SENSOR';
    geolocation = AvailabilityState.ERROR;
    nfc = AvailabilityState.ERROR;
    torch = AvailabilityState.ERROR;
    wakeLock = AvailabilityState.ERROR;

    constructor() {
        this._geolocationService
            .availabilityState()
            .pipe(takeUntil(this._subject))
            .subscribe((status) => {
                this.geolocation = status;
            });
        this._compassService
            .availabilityState()
            .pipe(takeUntil(this._subject))
            .subscribe((status) => {
                this.compass = status;
            });
        this._compassService
            .typeObservable()
            .pipe(takeUntil(this._subject))
            .subscribe((type) => {
                this.compassType = type;
            });
        this._nfcService
            .availabilityState(false)
            .pipe(takeUntil(this._subject))
            .subscribe((status) => {
                this.nfc = status;
            });
        this._torchService
            .availabilityState(false)
            .pipe(takeUntil(this._subject))
            .subscribe((status) => {
                this.torch = status;
            });
        this._wakeLockService
            .availabilityState()
            .pipe(takeUntil(this._subject))
            .subscribe((status) => {
                this.wakeLock = status;
            });
    }

    onDestroy() {
        this._subject.next(null);
        this._subject.complete();
    }
}
