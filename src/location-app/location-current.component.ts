import { Component, css, di, emit, html } from 'fudgel';
import { CoordinateService } from '../services/coordinate.service';
import { DistanceService } from '../services/distance.service';
import {
    GeolocationCoordinateResult,
    GeolocationCoordinateResultSuccess,
    GeolocationService,
} from '../services/geolocation.service';
import { LatLon } from './location-coordinates.component';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component('location-current', {
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

        .list {
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

        .gapAbove {
            padding-top: 0.4em;
        }

        .multi-line {
            display: flex;
            flex-direction: column;
            text-align: center;
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
            <div *if="latLon" class="content">
                <location-coordinates .coords="latLon"></location-coordinates>
                <div class="gapAbove">
                    <location-field id="current.1" default="ACCURACY"></location-field>
                </div>
                <div>
                    <location-field id="current.2" default="SPEED"></location-field>
                </div>
                <div>
                    <location-field id="current.3" default="HEADING"></location-field>
                </div>
                <div>
                    <location-field id="current.4" default="ALTITUDE"></location-field>
                </div>
                <div>
                    <location-field id="current.5" default="ALTITUDE_ACCURACY"></location-field>
                </div>
            </div>
            <div *if="position && position.error" class="content">
                <p>There is an error retrieving the location.</p>
                <p
                    *if="position.error.code === position.error.PERMISSION_DENIED"
                >
                    Permission denied.
                </p>
                <p
                    *if="position.error.code === position.error.POSITION_UNAVAILABLE"
                >
                    Position unavailable.
                </p>
            </div>
            <div *if="!position" class="content">
                <p>Retrieving location...</p>
            </div>
            <div class="buttons">
                <back-button></back-button>
                <scaling-icon
                    class="list"
                    @click.stop.prevent="goToList()"
                    href="./list.svg"
                ></scaling-icon>
            </div>
        </div>
    `,
})
export class LocationCurrentComponent {
    #coordinateService = di(CoordinateService);
    #distanceService = di(DistanceService);
    #geolocationService = di(GeolocationService);
    #subject = new Subject();
    latLon: LatLon | null = null;
    position: GeolocationCoordinateResult | null = null;

    onInit() {
        this.#geolocationService
            .getPosition()
            .pipe(takeUntil(this.#subject))
            .subscribe((position) => {
                this.position = position;
                this.#redraw();
            });
    }

    onDestroy() {
        this.#subject.next(null);
        this.#subject.complete();
    }

    goToList() {
        emit(this, 'list');
    }

    toggleCoordinateSystem() {
        this.#coordinateService.toggleSystem();
        this.#redraw();
    }

    toggleDistanceSystem() {
        this.#distanceService.toggleSystem();
        this.#redraw();
    }

    #redraw() {
        if (this.position && this.position.timestamp) {
            const positionTyped = this.position as GeolocationCoordinateResultSuccess;
            this.latLon = {
                lat: positionTyped.latitude,
                lon: positionTyped.longitude,
            };
        } else {
            this.latLon = null;
        }
    }
}
