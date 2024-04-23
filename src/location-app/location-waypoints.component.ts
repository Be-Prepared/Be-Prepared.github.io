import CheapRuler from 'cheap-ruler';
import { Component, css, di, emit, html } from 'fudgel';
import { DirectionService } from '../services/direction.service';
import { DistanceService } from '../services/distance.service';
import {
    GeolocationCoordinateResult,
    GeolocationCoordinateResultSuccess,
    GeolocationService,
} from '../services/geolocation.service';
import { I18nService } from '../i18n/i18n.service';
import { first } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { WaypointSaved, WaypointService } from './waypoint.service';

interface WaypointAugmented extends WaypointSaved {
    meters: number;
    location: string;
}

@Component('location-waypoints', {
    style: css`
        .wrapper {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
        }

        .buttons {
            display: flex;
            flex-direction: row;
            justify-content: space-between;
        }

        .add {
            padding: 5px;
        }

        .content {
            height: 100%;
            width: 100%;
            padding: 1em;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            box-sizing: border-box;
            overflow: hidden;
            font-size: 3em;
        }

        .pointListWrapper {
            width: 100%;
            max-height: 100%;
            border: var(--table-border);
            display: flex;
            flex-direction: column;
        }

        .pointListHeader {
            flex-shrink: 0;
            width: 100%;
            padding: 0.5em;
            box-sizing: border-box;
            display: flex;
            justify-content: space-between;
            border: var(--table-border);
            font-weight: bold;
            overflow: hidden;
        }

        .pointList {
            overflow: auto;
        }

        .pointListLine {
            width: 100%;
            justify-content: space-between;
            display: flex;
            border: var(--table-border);
            box-sizing: border-box;
        }

        .name {
            text-align: left;
            flex-shrink: 1;
            text-overflow: ellipsis;
            overflow: hidden;
            white-space: nowrap;
            padding: 0 0.2em;
        }

        .location {
            box-sizing: border-box;
            white-space: nowrap;
            padding: 0 0.2em 0 0.8em;
        }

        @media (max-width: 960px) {
            .content {
                font-size: 2.5em;
            }
        }

        @media (max-width: 720px) {
            .content {
                font-size: 1.8em;
            }
        }

        @media (max-width: 480px) {
            .content {
                font-size: 1.3em;
            }
        }

        @media (max-width: 360px) {
            .content {
                font-size: 1em;
            }
        }

        @media (orientation: landscape) {
            .wrapper {
                flex-direction: row-reverse;
            }

            .buttons {
                flex-direction: column-reverse;
            }
        }
    `,
    template: html`
        <div class="wrapper">
            <div class="content">
                <div *if="points.length" class="pointListWrapper">
                    <div class="pointListHeader">
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
                    <div class="pointList">
                        <div
                            *for="waypoint of points"
                            class="pointListLine"
                            @click.stop.prevent="goToEdit(waypoint)"
                        >
                            <div class="name">{{ waypoint.name }}</div>
                            <div class="location">{{ waypoint.location }}</div>
                        </div>
                    </div>
                </div>
                <div *if="!points.length">
                    <i18n-label id="location.waypoints.noWaypoints"></i18n-label>
                </div>
            </div>
            <div class="buttons">
                <back-button emit="current"></back-button>
                <scaling-icon
                    class="add"
                    @click.stop.prevent="goToAdd()"
                    href="./add.svg"
                ></scaling-icon>
            </div>
        </div>
    `,
})
export class LocationWaypointsComponent {
    #directionService = di(DirectionService);
    #distanceService = di(DistanceService);
    #geolocationService = di(GeolocationService);
    #i18nService = di(I18nService);
    #subscription?: Subscription;
    #waypointService = di(WaypointService);
    points: WaypointAugmented[] = [];
    position: GeolocationCoordinateResult | null = null;

    onInit() {
        this.#subscription = this.#geolocationService
            .getPosition()
            .pipe(first())
            .subscribe((position) => {
                this.position = position;
                this.#updatePoints(this.points);
            });
        this.#updatePoints(this.#waypointService.getPoints());
    }

    onDestroy() {
        this.#subscription && this.#subscription.unsubscribe();
    }

    goToAdd() {
        emit(this, 'add');
    }

    goToEdit(waypoint: WaypointSaved) {
        emit(this, 'edit', waypoint.id);
    }

    sortByDistance() {
        this.points = this.#sortByDistance(this.points);
    }

    sortByName() {
        this.points = this.#sortByName(this.points);
    }

    #sortByDistance(points: WaypointAugmented[]): WaypointAugmented[] {
        return points.sort((a, b) => a.meters - b.meters);
    }

    #sortByName(points: WaypointAugmented[]): WaypointAugmented[] {
        return points.sort((a, b) => a.name.localeCompare(b.name));
    }

    #updatePoints(points: WaypointSaved[]) {
        const position = this.position;

        if (!position || !position.timestamp) {
            this.#updatePointsNoPosition(points);
            return;
        }

        const positionTyped = position as GeolocationCoordinateResultSuccess;
        const cheapRuler = new CheapRuler(positionTyped.latitude, 'meters');
        const augmentedPoints = points.map((point) => {
            const pointA: [number, number] = [
                positionTyped.longitude,
                positionTyped.latitude,
            ];
            const pointB: [number, number] = [point.lon, point.lat];
            const meters = cheapRuler.distance(pointA, pointB);
            console.log(pointA, pointB, meters);
            const distance = this.#distanceService.metersToString(meters);
            const direction = cheapRuler.bearing(pointA, pointB);
            const compassPoint =
                this.#directionService.toCompassPoint(direction);

            return {
                ...point,
                meters,
                location: `${distance} ${compassPoint}`,
            };
        });

        this.points = this.#sortByDistance(augmentedPoints);
    }

    #updatePointsNoPosition(points: WaypointSaved[]) {
        const emptyPoints = points.map((point) => {
            return {
                ...point,
                meters: 0,
                location: this.#i18nService.get(
                    'location.waypoints.unknownLocation'
                ),
            };
        });

        this.points = this.#sortByName(emptyPoints);
    }
}
