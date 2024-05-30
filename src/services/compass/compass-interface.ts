import { AvailabilityState } from '../../datatypes/availability-state';
import { Observable } from 'rxjs';

export interface CompassInterface {
    availabilityState(): Observable<AvailabilityState>;
    getCompassBearing(): Observable<number>;
    prompt(): void;
    type(): string;
}
