import { AccessState } from './access/access-controller';
import {
    catchError,
    finalize,
    first,
    map,
    switchMap,
    tap,
    timeout,
} from 'rxjs/operators';
import { CoordinateService } from './coordinate.service';
import { di } from '../di';
import { GeolocationService } from './geolocation.service';
import { LatLon } from '../datatypes/lat-lon';
import { Observable, of } from 'rxjs';

// Shorthand only needs a position within tens of kilometers, so a fix from
// the last few minutes is as good as a new one and avoids waking the GPS.
const MAX_AGE_MS = 10 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 10000;

export interface ParsedLocation {
    latLon: LatLon | null;
    // The text was shorthand and was completed using the current location.
    usedReference: boolean;
    // The text was shorthand but the current location wasn't available.
    missingReference: boolean;
}

// Supplies a reference location for shorthand coordinates (MGRS without the
// grid zone, UTM without the zone number, short plus codes).
export class ReferenceLocationService {
    private _coordinateService = di(CoordinateService);
    private _geolocationService = di(GeolocationService);
    private _last: (LatLon & { time: number }) | null = null;

    // Parses typed coordinates. The GPS is only consulted when the text
    // doesn't parse on its own and looks like shorthand. `waiting` is called
    // with true while waiting for the GPS and false afterwards so the screen
    // can show a message.
    parseLocation(
        str: string,
        waiting: (isWaiting: boolean) => void = () => {}
    ): Observable<ParsedLocation> {
        return this._coordinateService.fromString(str).pipe(
            switchMap((latLon) => {
                if (latLon || !this._coordinateService.needsReference(str)) {
                    return of({
                        latLon,
                        usedReference: false,
                        missingReference: false,
                    });
                }

                waiting(true);

                return this.getReference().pipe(
                    finalize(() => waiting(false)),
                    switchMap((reference) => {
                        if (!reference) {
                            return of({
                                latLon: null,
                                usedReference: false,
                                missingReference: true,
                            });
                        }

                        return this._coordinateService
                            .fromString(str, reference)
                            .pipe(
                                map((result) => ({
                                    latLon: result,
                                    usedReference: true,
                                    missingReference: false,
                                }))
                            );
                    })
                );
            })
        );
    }

    // Emits once: the current position, or null when it isn't available
    // within the timeout. Uses the position already flowing when another
    // part of the app is watching the GPS.
    getReference(timeoutMs = DEFAULT_TIMEOUT_MS): Observable<LatLon | null> {
        if (this._last && Date.now() - this._last.time < MAX_AGE_MS) {
            return of({ lat: this._last.lat, lon: this._last.lon });
        }

        if (!this._geolocationService.isSupported()) {
            return of(null);
        }

        return this._geolocationService.availabilityState().pipe(
            first(),
            switchMap((state) => {
                if (
                    state === AccessState.DENIED ||
                    state === AccessState.UNAVAILABLE
                ) {
                    return of(null);
                }

                return this._geolocationService.getPositionSuccess().pipe(
                    first(),
                    timeout(timeoutMs),
                    map((position): LatLon | null => ({
                        lat: position.lat,
                        lon: position.lon,
                    })),
                    tap((position) => {
                        if (position) {
                            this._last = { ...position, time: Date.now() };
                        }
                    }),
                    catchError(() => of(null))
                );
            }),
            catchError(() => of(null))
        );
    }
}
