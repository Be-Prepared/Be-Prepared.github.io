import { Component, css, di, html } from 'fudgel';
import { GeolocationService } from '../services/geolocation.service';
import { Subscription } from 'rxjs';
import { first, timeout } from 'rxjs/operators';
import { WaypointSaved } from '../datatypes/waypoint-saved';
import { WaypointService } from './waypoint.service';

@Component('location-add-app', {
    style: css``,
    template: html`<location-wrapper></location-wrapper>`,
})
export class LocationAddAppComponent {
    private _geolocationService = di(GeolocationService);
    private _subscription?: Subscription;
    private _waypointService = di(WaypointService);
    id?: string;
    location: string = '';
    point: WaypointSaved | null = null;

    onInit() {
        const point = this._waypointService.newPoint();
        point.name = `Unnamed Waypoint ${point.id}`;
        this._subscription = this._geolocationService
            .getPosition()
            .pipe(timeout(2000), first())
            .subscribe((position) => {
                if (position && position.success) {
                    point.lat = position.latitude;
                    point.lon = position.longitude;
                }

                this._waypointService.updatePoint(point);
                history.replaceState(
                    {},
                    document.title,
                    `/location-edit/${point.id}`,
                );
            });
    }

    onDestroy() {
        this._subscription && this._subscription.unsubscribe();
    }
}
