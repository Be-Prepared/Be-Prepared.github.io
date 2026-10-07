import { AccessState } from '../services/access/access-controller';
import { component, css, html } from 'fudgel';
import { CoordinateService } from '../services/coordinate.service';
import { di } from '../di';
import { DirectionService } from '../services/direction.service';
import { DistanceService } from '../services/distance.service';
import {
    GeolocationCoordinateResult,
    GeolocationCoordinateResultSuccess,
    GeolocationService,
} from '../services/geolocation.service';
import { I18nService } from '../i18n/i18n.service';
import { filter, first, switchMap } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { WaypointSaved } from '../datatypes/waypoint-saved';
import { WaypointService } from './waypoint.service';

interface WaypointAugmented extends WaypointSaved {
    meters: number;
    location: string;
}

export class LocationListAppComponent {
    private _coordinateService = di(CoordinateService);
    private _directionService = di(DirectionService);
    private _distanceService = di(DistanceService);
    private _geolocationService = di(GeolocationService);
    private _i18nService = di(I18nService);
    private _subscription?: Subscription;
    private _waypointService = di(WaypointService);
    points: WaypointAugmented[] = [];
    position: GeolocationCoordinateResult | null = null;

    onInit() {
        // Wait for permission so the GPS only starts (and the browser only
        // prompts) after the "Allow" button in location-wrapper.
        this._subscription = this._geolocationService
            .availabilityState()
            .pipe(
                filter((state) => state === AccessState.READY),
                first(),
                switchMap(() =>
                    this._geolocationService.getPosition().pipe(first())
                )
            )
            .subscribe((position) => {
                this.position = position;
                this._updatePoints(this.points);
            });
        this._updatePoints(this._waypointService.getPoints());
    }

    onDestroy() {
        this._subscription && this._subscription.unsubscribe();
    }

    goToAdd() {
        history.pushState({}, document.title, '/location-add');
    }

    goToEdit(waypoint: WaypointSaved) {
        history.pushState({}, document.title, `/location-edit/${waypoint.id}`);
    }

    sortByDistance() {
        this.points = this._sortByDistance(this.points);
    }

    sortByName() {
        this.points = this._sortByName(this.points);
    }

    private _sortByDistance(points: WaypointAugmented[]): WaypointAugmented[] {
        return points.sort((a, b) => a.meters - b.meters);
    }

    private _sortByName(points: WaypointAugmented[]): WaypointAugmented[] {
        return points.sort((a, b) => a.name.localeCompare(b.name));
    }

    private _updatePoints(points: WaypointSaved[]) {
        const position = this.position;

        if (!position || !position.success) {
            this._updatePointsNoPosition(points);
            return;
        }

        const positionTyped = position as GeolocationCoordinateResultSuccess;
        const augmentedPoints = points.map((point) => {
            const meters = this._coordinateService.distance(
                point,
                positionTyped
            );
            const distance = this._distanceService.metersToString(meters);
            const direction = this._coordinateService.bearing(
                positionTyped,
                point,
                true
            );
            const compassPoint =
                this._directionService.compassPointLabel(direction);

            return {
                ...point,
                meters,
                location: `${distance} ${compassPoint}`,
            };
        });

        this.points = this._sortByDistance(augmentedPoints);
    }

    private _updatePointsNoPosition(points: WaypointSaved[]) {
        const emptyPoints = points.map((point) => {
            return {
                ...point,
                meters: 0,
                location: this._i18nService.get(
                    'location.waypoints.unknownLocation'
                ),
            };
        });

        this.points = this._sortByName(emptyPoints);
    }
}

component('location-list-app', {
    style: css`
        .full-flex {
            display: flex;
            height: 100%;
            width: 100%;
            max-width: 40rem;
            margin: 0 auto;
            box-sizing: border-box;
            padding: var(--space-4);
            justify-content: center;
            align-items: center;
            /* Location screens scale their text up; a list reads better at
               a steady size. */
            font-size: 1.125rem;
            color: var(--fg-muted);
            text-align: center;
        }

        .point-list-wrapper {
            width: 100%;
            max-height: 100%;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
            overflow: hidden;
            color: var(--fg);
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-l);
        }

        /* Tap a heading to sort by it. */
        .point-list-weader {
            flex-shrink: 0;
            padding: var(--space-2) var(--space-4);
            display: flex;
            justify-content: space-between;
            font-size: 0.8em;
            color: var(--fg-muted);
            background: var(--surface-2);
            border-bottom: 1px solid var(--border);
            cursor: pointer;
        }

        .point-list {
            overflow: auto;
        }

        .point-list-line {
            padding: var(--space-3) var(--space-4);
            justify-content: space-between;
            align-items: baseline;
            gap: var(--space-3);
            display: flex;
            cursor: pointer;
        }

        .point-list-line + .point-list-line {
            border-top: 1px solid var(--border);
        }

        .point-list-line:active {
            background: var(--surface-2);
        }

        .name {
            text-align: start;
            flex-shrink: 1;
            min-width: 0;
            text-overflow: ellipsis;
            overflow: hidden;
            white-space: nowrap;
            font-weight: 600;
        }

        .location {
            flex-shrink: 0;
            white-space: nowrap;
            color: var(--fg-muted);
            font-variant-numeric: tabular-nums;
        }

        .point-list-weader .name,
        .point-list-weader .location {
            font-weight: 400;
            color: inherit;
        }
    `,
    template: html`
        <location-wrapper>
            <default-layout>
                <div class="full-flex">
                    <div *if="points.length" class="point-list-wrapper">
                        <div class="point-list-weader">
                            <div class="name" @click="sortByName()">
                                <i18n-label
                                    id="location.waypoints.name"
                                ></i18n-label>
                            </div>
                            <div class="location" @click="sortByDistance()">
                                <i18n-label
                                    id="location.waypoints.location"
                                ></i18n-label>
                            </div>
                        </div>
                        <div class="point-list">
                            <div
                                *for="waypoint of points"
                                class="point-list-line"
                                @click.stop.prevent="goToEdit(waypoint)"
                            >
                                <div class="name">{{ waypoint.name }}</div>
                                <div class="location">
                                    {{ waypoint.location }}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div *if="!points.length">
                        <i18n-label
                            id="location.waypoints.noWaypoints"
                        ></i18n-label>
                    </div>
                </div>
                <icon-button
                    slot="more-buttons"
                    @click.stop.prevent="goToAdd()"
                    href="/add.svg"
                    label-id="location.addWaypoint"
                ></icon-button>
            </default-layout>
        </location-wrapper>
    `,
}, LocationListAppComponent);
