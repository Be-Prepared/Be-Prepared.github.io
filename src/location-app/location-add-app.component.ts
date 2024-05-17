import { catchError, first, tap, timeout } from 'rxjs/operators';
import { CoordinateService } from '../services/coordinate.service';
import { Component, css, di, html } from 'fudgel';
import { GeolocationService } from '../services/geolocation.service';
import { I18nService } from '../i18n/i18n.service';
import { MiniMustacheService } from '../services/mini-mustache.service';
import { of, Subscription } from 'rxjs';
import { WaypointSaved } from '../datatypes/waypoint-saved';
import { WaypointService } from './waypoint.service';

@Component('location-add-app', {
    style: css`
        .full {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100%;
        }
    `,
    template: html` <location-wrapper>
        <div class="full">
            <i18n-label id="location.add.gettingCurrentLocation"></i18n-label>
        </div>
    </location-wrapper>`,
})
export class LocationAddAppComponent {
    private _coordinateService = di(CoordinateService);
    private _geolocationService = di(GeolocationService);
    private _i18nService = di(I18nService);
    private _miniMustacheService = di(MiniMustacheService);
    private _subscription?: Subscription;
    private _waypointService = di(WaypointService);

    onInit() {
        const params = new URLSearchParams(window.location.search);
        const point = this._waypointService.newPoint();
        point.name = this._makeName(point);
        const parsedLocation = this._coordinateService.fromString(
            params.get('location') || ''
        );

        if (parsedLocation) {
            point.lat = parsedLocation.lat;
            point.lon = parsedLocation.lon;
            this._proceed(point);
        }

        this._subscription = this._geolocationService
            .getPosition()
            .pipe(
                timeout(2000),
                first(),
                tap((position) => {
                    if (position && position.success) {
                        point.lat = position.latitude;
                        point.lon = position.longitude;
                    }
                }),
                catchError(() => of(null))
            )
            .subscribe(() => {
                this._proceed(point);
            });
    }

    onDestroy() {
        this._subscription && this._subscription.unsubscribe();
    }

    _makeName(point: WaypointSaved) {
        const template = this._i18nService.get('location.add.waypointName');
        const name = this._miniMustacheService.parse(template, {
            id: point.id.toLocaleString(),
        });

        return name;
    }

    _proceed(point: WaypointSaved) {
        this._waypointService.updatePoint(point);
        history.replaceState({}, document.title, `/location-edit/${point.id}`);
    }
}
