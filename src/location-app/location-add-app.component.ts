import { catchError, first, tap, timeout } from 'rxjs/operators';
import { Component, css, html } from 'fudgel';
import { CoordinateService } from '../services/coordinate.service';
import { di } from '../di';
import { GeolocationService } from '../services/geolocation.service';
import { I18nService } from '../i18n/i18n.service';
import { MiniMustacheService } from '../services/mini-mustache.service';
import { of, Subscription } from 'rxjs';
import { WaypointSaved } from '../datatypes/waypoint-saved';
import { WaypointService } from './waypoint.service';

@Component('location-add-app', {
    attr: ['geo'],
    style: css`
        .full {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100%;
        }
    `,
    template: html`
        <location-wrapper>
            <div class="full">
                <i18n-label
                    id="location.add.gettingCurrentLocation"
                ></i18n-label>
            </div>
        </location-wrapper>
    `,
})
export class LocationAddAppComponent {
    private _coordinateService = di(CoordinateService);
    private _geolocationService = di(GeolocationService);
    private _i18nService = di(I18nService);
    private _miniMustacheService = di(MiniMustacheService);
    private _subscription?: Subscription;
    private _waypointService = di(WaypointService);
    geo?: string;

    onInit() {
        if (this.geo) {
            this._useGeo();
        } else {
            this._useLocation();
        }
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
        // This doesn't work when called during onInit()
        setTimeout(() => {
            history.replaceState(
                {},
                document.title,
                `/location-edit/${point.id}`
            );
        });
    }

    _useGeo() {
        const point = this._waypointService.newPoint();
        point.name = this._makeName(point);
        this._coordinateService
            .fromString(this.geo || '')
            .subscribe((parsedLocation) => {
                if (parsedLocation) {
                    point.lat = parsedLocation.lat;
                    point.lon = parsedLocation.lon;
                    const params = new URLSearchParams(
                        `?${window.location.search
                            .slice(1)
                            .replace(/\?/g, '&')}`
                    );
                    const name = params.get('q');

                    if (name) {
                        point.name = name;
                    }
                }

                this._proceed(point);
            });
    }

    _useLocation() {
        const point = this._waypointService.newPoint();
        point.name = this._makeName(point);
        this._subscription = this._geolocationService
            .getPosition()
            .pipe(
                timeout(2000),
                first(),
                tap((position) => {
                    if (position && position.success) {
                        point.lat = position.lat;
                        point.lon = position.lon;
                    }
                }),
                catchError(() => of(null))
            )
            .subscribe(() => {
                this._proceed(point);
            });
    }
}
