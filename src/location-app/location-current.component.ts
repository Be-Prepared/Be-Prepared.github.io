import { DirectionService } from '../services/direction.service';
import { Component, css, di, emit, html } from 'fudgel';
import { CoordinateService } from '../services/coordinate.service';
import { DistanceService } from '../services/distance.service';
import {
    GeolocationCoordinateResult,
    GeolocationCoordinateResultSuccess,
    GeolocationService,
} from '../services/geolocation.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface DataToDisplay {
    lat: string | null;
    lon: string | null;
    mgrs: string | null;
    utmups: string | null;
    acc: string;
    alt: string | null;
    altAcc: string | null;
    speed: string;
    headingDirection: string | null;
}

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
            <div *if="dataToDisplay" class="content">
                <div *if="dataToDisplay.lat" class="multi-line">
                    <changeable-setting @click="toggleCoordinateSystem()">
                        <div>{{ dataToDisplay.lat }}</div>
                        <div>{{ dataToDisplay.lon }}</div>
                    </changeable-setting>
                </div>
                <div *if="dataToDisplay.mgrs" class="multi-line">
                    <changeable-setting @click="toggleCoordinateSystem()">
                        <div>
                            <i18n-label id="location.mgrs" ws=""></i18n-label>
                        </div>
                        <div>{{ dataToDisplay.mgrs }}</div>
                    </changeable-setting>
                </div>
                <div *if="dataToDisplay.utmups" class="multi-line">
                    <changeable-setting @click="toggleCoordinateSystem()">
                        <div>
                            <i18n-label id="location.utmups" ws=""></i18n-label>
                        </div>
                        <div>{{ dataToDisplay.utmups }}</div>
                    </changeable-setting>
                </div>
                <div class="gapAbove">
                    <i18n-label id="location.accuracy"></i18n-label>
                    <changeable-setting @click="toggleDistanceSystem()">
                        {{ dataToDisplay.acc }}
                    </changeable-setting>
                </div>
                <div>
                    <i18n-label id="location.speed"></i18n-label>
                    <changeable-setting @click="toggleDistanceSystem()">
                        {{ dataToDisplay.speed }}
                    </changeable-setting>
                </div>
                <div>
                    <i18n-label id="location.heading"></i18n-label>
                    <span *if="dataToDisplay.headingDirection !== null"
                        >{{ dataToDisplay.headingDirection }}</span
                    >
                    <span *if="dataToDisplay.heading === null"
                        ><i18n-label id="location.headingNowhere"></i18n-label
                    ></span>
                </div>
                <div *if="alt">
                    <i18n-label id="location.altitude" ws=""></i18n-label>
                    <changeable-setting @click="toggleDistanceSystem()">
                        {{ dataToDisplay.alt }}
                    </changeable-setting>
                </div>
                <div *if="altAcc">
                    <i18n-label
                        id="location.altitudeAccuracy"
                        ws=""
                    ></i18n-label>
                    <changeable-setting @click="toggleDistanceSystem()">
                        {{ dataToDisplay.altAcc }}
                    </changeable-setting>
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
    #directionService = di(DirectionService);
    #distanceService = di(DistanceService);
    #geolocationService = di(GeolocationService);
    #subject = new Subject();
    dataToDisplay: DataToDisplay | null = null;
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
            this.#updateDisplayedValues(
                this.position as GeolocationCoordinateResultSuccess
            );
        } else {
            this.dataToDisplay = null;
        }
    }

    #updateDisplayedValues(position: GeolocationCoordinateResultSuccess) {
        const system = this.#coordinateService.latLonToSystem(
            position.latitude,
            position.longitude
        );
        const acc = this.#distanceService.metersToString(position.accuracy);
        const alt = position.altitude
            ? this.#distanceService.metersToString(position.altitude)
            : null;
        const altAcc = position.altitudeAccuracy
            ? this.#distanceService.metersToString(position.altitudeAccuracy)
            : null;
        const speed = this.#distanceService.metersToString(
            position.speed,
            true
        );
        let headingDirection = null;

        // Preserve the last heading
        if (!isNaN(position.heading)) {
            headingDirection = this.#directionService.toHeadingDirection(
                position.heading
            );
        }

        // Tie to a single property for faster updates
        this.dataToDisplay = {
            lat: 'lat' in system ? system.lat : null,
            lon: 'lon' in system ? system.lon : null,
            mgrs: 'mgrs' in system ? system.mgrs : null,
            utmups: 'utmups' in system ? system.utmups : null,
            acc,
            alt,
            altAcc,
            speed,
            headingDirection,
        };
    }
}
