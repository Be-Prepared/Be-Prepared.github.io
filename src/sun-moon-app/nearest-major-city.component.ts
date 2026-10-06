import { component, css, html } from 'fudgel';
import { CoordinateService } from '../services/coordinate.service';
import { di } from '../di';
import { LatLon } from '../datatypes/lat-lon';
import { DirectionService } from '../services/direction.service';
import { DistanceService } from '../services/distance.service';
import { Subscription } from 'rxjs';

// Within this distance the place is the city, so a direction means nothing.
const SAME_PLACE_METERS = 1000;

export class NearestMajorCityComponent {
    private _coordinateService = di(CoordinateService);
    private _directionService = di(DirectionService);
    private _distanceService = di(DistanceService);
    private _subscription: Subscription | null = null;
    coordinates: LatLon | null = null;
    detail = '';
    name = '';

    onChange(prop: string) {
        if (prop !== 'coordinates' || !this.coordinates) {
            return;
        }

        this._subscription?.unsubscribe();
        this._subscription = this._coordinateService
            .getNearestCityByCoords(this.coordinates.lat, this.coordinates.lon)
            .subscribe((nearest) => {
                this.name = nearest.name;

                if (nearest.distance < SAME_PLACE_METERS) {
                    this.detail = '';

                    return;
                }

                const distance = this._distanceService.metersToString(
                    nearest.distance
                );
                const direction = this._directionService.toHeadingDirection(
                    nearest.bearing
                );
                this.detail = `${distance}, ${direction}`;
            });
    }

    onDestroy() {
        this._subscription?.unsubscribe();
    }
}

component(
    'nearest-major-city',
    {
        prop: ['coordinates'],
        style: css`
            :host {
                display: flex;
                justify-content: space-between;
                align-items: baseline;
                flex-wrap: wrap;
                gap: 0 var(--space-3);
                padding: var(--space-2) 0;
                border-top: 1px solid var(--border);
                border-bottom: 1px solid var(--border);
            }

            .label {
                color: var(--fg-muted);
            }

            .value {
                text-align: end;
                font-weight: 600;
            }

            .detail {
                font-weight: 400;
                color: var(--fg-muted);
                font-size: 0.9rem;
            }
        `,
        template: html`
            <span class="label">
                <i18n-label
                    id="sunMoon.nearestMajorCity.label"
                    ws=""
                ></i18n-label>
            </span>
            <span class="value">
                {{name}}
                <div *if="detail" class="detail">{{detail}}</div>
            </span>
        `,
    },
    NearestMajorCityComponent
);
