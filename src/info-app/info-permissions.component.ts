import { AvailabilityState } from '../datatypes/availability-state';
import { Component, css, di, html } from 'fudgel';
import { GeolocationService } from '../services/geolocation.service';
import { PositionService } from '../services/position.service';
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
                <i18n-label id="info.geolocation"></i18n-label>
                <info-app-availability
                    .availability-state="geolocation"
                ></info-app-availability>
            </li>
            <li>
                <i18n-label id="info.position"></i18n-label>
                <info-app-availability
                    .availability-state="position"
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
    private _geolocationService = di(GeolocationService);
    private _positionService = di(PositionService);
    private _subject = new Subject();
    private _torchService = di(TorchService);
    private _wakeLockService = di(WakeLockService);
    geolocation = AvailabilityState.ERROR;
    position = AvailabilityState.ERROR;
    torch = AvailabilityState.ERROR;
    wakeLock = AvailabilityState.ERROR;

    constructor() {
        this._geolocationService
            .availabilityState()
            .pipe(takeUntil(this._subject))
            .subscribe((status) => {
                this.geolocation = status;
            });
        this._positionService
            .availabilityState()
            .pipe(takeUntil(this._subject))
            .subscribe((status) => {
                this.position = status;
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
