import { AccessState } from '../services/access/access-controller';
import { component, css, html } from 'fudgel';
import { di } from '../di';
import { filter, first, switchMap, timeout } from 'rxjs/operators';
import { GeolocationService } from '../services/geolocation.service';
import { I18nService } from '../i18n/i18n.service';
import { MiniMustacheService } from '../services/mini-mustache.service';
import { parseGeoUri } from './geo-uri';
import { pointFromParams, SharePoint } from './share-formats';
import { Subscription } from 'rxjs';
import { ToastService } from '../services/toast.service';
import { WaypointSaved } from '../datatypes/waypoint-saved';
import { WaypointService } from './waypoint.service';

// GPS can take a while to get a first fix, especially from a cold start.
const LOCATION_TIMEOUT_MS = 30000;

export class LocationAddAppComponent {
    private _geolocationService = di(GeolocationService);
    private _i18nService = di(I18nService);
    private _miniMustacheService = di(MiniMustacheService);
    private _subscription?: Subscription;
    private _toastService = di(ToastService);
    private _waypointService = di(WaypointService);
    geo?: string;

    onInit() {
        const shared = pointFromParams(window.location.search);

        if (this.geo) {
            this._useGeo();
        } else if (shared) {
            // A Be Prepared share link: /location-add?lat=..&lon=..&name=..
            this._useShared(shared);
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
        // The query may be inside the URI or, for older links, on the page.
        const parsed = parseGeoUri(this.geo || '', window.location.search);

        if (!parsed) {
            this._fail('location.edit.badLocation');

            return;
        }

        const point = this._waypointService.newPoint();
        point.lat = parsed.lat;
        point.lon = parsed.lon;
        point.name = parsed.name || this._makeName(point);
        this._proceed(point);
    }

    _useShared(shared: SharePoint) {
        const point = this._waypointService.newPoint();
        point.lat = shared.lat;
        point.lon = shared.lon;
        point.name = shared.name || this._makeName(point);
        this._proceed(point);
    }

    _useLocation() {
        // The waypoint is only created once there is a real fix. Waiting for
        // permission doesn't count toward the timeout; location-wrapper shows
        // the permission screen meanwhile.
        this._subscription = this._geolocationService
            .availabilityState()
            .pipe(
                filter((state) => state === AccessState.READY),
                first(),
                switchMap(() =>
                    this._geolocationService
                        .getPositionSuccess()
                        .pipe(first(), timeout(LOCATION_TIMEOUT_MS))
                )
            )
            .subscribe({
                next: (position) => {
                    const point = this._waypointService.newPoint();
                    point.lat = position.lat;
                    point.lon = position.lon;
                    point.name = this._makeName(point);
                    this._proceed(point);
                },
                error: () => this._fail('location.add.noLocation'),
            });
    }

    private _fail(messageId: string) {
        this._toastService.popI18n(messageId);
        // This doesn't work when called during onInit()
        setTimeout(() => {
            if (history.length > 1) {
                history.back();
            } else {
                // Opened from another app, so there's nothing to go back to.
                history.replaceState({}, document.title, '/location-list');
            }
        });
    }
}

component('location-add-app', {
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
}, LocationAddAppComponent);
