import { AvailabilityState } from '../datatypes/availability-state';
import { di } from 'fudgel';
import { finalize, share, switchMap } from 'rxjs/operators';
import { Observable, of, Subject } from 'rxjs';
import { PermissionsService } from './permissions.service';

export interface NfcScanResult {
    initializeError?: true;
    readError?: true;
    ready?: true;
    records?: ReadonlyArray<NDEFRecord>;
    serialNumber?: string;
    timestamp: Date;
}

export class NfcService {
    private _permissionsService = di(PermissionsService);
    private _observable: Observable<NfcScanResult> | null = null;

    availabilityState() {
        if (!window.NDEFReader) {
            return of(AvailabilityState.UNAVAILABLE);
        }

        return this._permissionsService.nfc().pipe(
            switchMap((state) => {
                return this._permissionsService.toAvailability(state);
            })
        );
    }

    scan() {
        if (this._observable) {
            return this._observable;
        }

        const subject = new Subject<NfcScanResult>();
        const instance = new NDEFReader();
        const abortController = new AbortController();
        instance.onreading = (event) => {
            subject.next({
                records: event.message.records,
                serialNumber: event.serialNumber,
                timestamp: new Date(),
            });
        };
        instance.onreadingerror = () => {
            subject.next({ readError: true, timestamp: new Date() });
        };
        instance.scan({ signal: abortController.signal }).then(
            () => {
                subject.next({ ready: true, timestamp: new Date() });
            },
            () => {
                subject.next({ initializeError: true, timestamp: new Date() });
            }
        );
        this._observable = subject.asObservable().pipe(
            finalize(() => {
                abortController.abort();
                this._observable = null;
            }),
            share()
        );

        return this._observable;
    }

    prompt() {
        return this._permissionsService.nfc(true);
    }
}
