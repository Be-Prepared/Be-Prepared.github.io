import { Component, css, di, html } from 'fudgel';
import { GeolocationService } from '../services/geolocation.service';
import { Subscription } from 'rxjs';
import { first, timeout } from 'rxjs/operators';
import { WaypointSaved, WaypointService } from './waypoint.service';

@Component('location-add-app', {
    style: css``,
    template: html`<location-wrapper></location-wrapper>`,
})
export class LocationAddAppComponent {
    #geolocationService = di(GeolocationService);
    #subscription?: Subscription;
    #waypointService = di(WaypointService);
    id?: string;
    location: string = '';
    point: WaypointSaved | null = null;

    onInit() {
        const point = this.#waypointService.newPoint();
        point.name = `Unnamed Waypoint ${point.id}`;
        this.#subscription = this.#geolocationService
            .getPosition()
            .pipe(timeout(2000), first())
            .subscribe((position) => {
                if (position && position.success) {
                    point.lat = position.latitude;
                    point.lon = position.longitude;
                }

                this.#waypointService.updatePoint(point);
                history.replaceState(
                    {},
                    document.title,
                    `/location-edit/${point.id}`
                );
            });
    }

    onDestroy() {
        this.#subscription && this.#subscription.unsubscribe();
    }
}
