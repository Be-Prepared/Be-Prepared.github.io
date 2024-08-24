import { AvailabilityState } from '../datatypes/availability-state';
import { di } from 'fudgel';
import { finalize, share, switchMap } from 'rxjs/operators';
import { from, Observable, of, Subject } from 'rxjs';
import {
    PermissionsService,
    PermissionsServiceState,
} from './permissions.service';
import { PreferenceService } from './preference.service';

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
    private _preferenceService = di(PreferenceService);
    private _observable: Observable<NfcScanResult> | null = null;

    availabilityState(useLiveValue: boolean) {
        if (!window.NDEFReader) {
            return of(AvailabilityState.UNAVAILABLE);
        }

        return this._permissionsService.nfc().pipe(
            switchMap((state) => {
                if (
                    state === PermissionsServiceState.ERROR ||
                    state === PermissionsServiceState.PROMPT ||
                    state === PermissionsServiceState.DENIED
                ) {
                    return this._permissionsService.toAvailability(state);
                }

                if (!useLiveValue) {
                    const cached = this._preferenceService.nfc.getItem();

                    if (cached) {
                        return of(AvailabilityState.ALLOWED);
                    }

                    if (cached === false) {
                        return of(AvailabilityState.UNAVAILABLE);
                    }
                }

                return from(
                    this._quickScan().then((success) => {
                        this._preferenceService.nfc.setItem(success);

                        if (success) {
                            return AvailabilityState.ALLOWED;
                        }

                        return AvailabilityState.UNAVAILABLE;
                    })
                );
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

    private _quickScan() {
        return new Promise<boolean>((resolve) => {
            const instance = new NDEFReader();
            instance.onreading = () => resolve(true);

            // This is true because it's indicating a partial read
            instance.onreadingerror = () => resolve(true);
            instance.scan({ signal: AbortSignal.timeout(1) }).then(
                () => resolve(true),
                // MDN indicates AbortError, actual event is TimeoutError
                (e) =>
                    resolve(
                        e?.name === 'AbortError' || e?.name === 'TimeoutError'
                    )
            );
        });
    }
}
