import { Component, css, di, html } from 'fudgel';
import { WaypointService } from './waypoint.service';

@Component('location-qr-app', {
    attr: ['id'],
    style: css``,
    template: html`
        <big-qr @click.stop.prevent="goBack()" content="geo:{{lat}},{{lon}}"></big-qr>
    `,
})
export class LocationQrComponent {
    private _waypointService = di(WaypointService);
    id?: string;
    lat?: number;
    lon?: number;

    onInit() {
        const id = this.id;
        let point;

        if (id) {
            point = this._waypointService.getPoint(+id);
        }

        if (!point) {
            history.go(-1);
            return;
        }

        this.lat = point.lat;
        this.lon = point.lon;
    }

    goBack() {
        history.go(-1);
    }
}
