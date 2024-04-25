import { AvailabilityState } from '../datatypes/availability-state';
import CheapRuler from 'cheap-ruler';
import { Component, css, di, html } from 'fudgel';
import { EMPTY, Subject } from 'rxjs';
import {
    GeolocationCoordinateResultSuccess,
    GeolocationService,
} from '../services/geolocation.service';
import {
    NavigationType,
    NavigationTypeService,
} from './navigation-type.service';
import { PositionService } from '../services/position.service';
import { switchMap, takeUntil } from 'rxjs/operators';

@Component('navigation-arrow', {
    attr: ['lat', 'lon'],
    style: css`
        :host {
            display: flex;
            overflow: hidden;
            justify-content: center;
            align-items: center;
            position: relative;
            padding: 10px;
            box-sizing: border-box;
        }

        .container {
            position: absolute;
            aspect-ratio: 1/1;
            margin: auto;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            max-width: 100%;
            max-height: 100%;
        }

        .compassRose {
            position: absolute;
            width: 100%;
            height: 100%;
        }

        .directionArrow {
            position: absolute;
            width: 100%;
            height: 100%;
            padding: 30%;
            box-sizing: border-box;
            color: #00e5e5;
        }
    `,
    template: html`
        <div class="container">
            <load-svg #ref="compassRose" class="compassRose" href="/compass-rose.svg" #ref="compassRose"></load-svg>
            <div class="directionArrow">
            <load-svg #ref="directionArrow" href="/navigation.svg" #ref="directionArrow"></load-svg>
            </div>
        </container>
    `,
})
export class NavigationArrowComponent {
    #geolocationService = di(GeolocationService);
    #currentPosition: GeolocationCoordinateResultSuccess | null = null;
    #currentBearing = 0;
    #currentHeading = 0;
    #currentNavigationType: NavigationType | null = null;
    #lat = 0;
    #lon = 0;
    #navigationTypeService = di(NavigationTypeService);
    #positionService = di(PositionService);
    #subject = new Subject();
    compassRose: HTMLElement | null = null;
    lat?: string;
    lon?: string;
    directionArrow: HTMLElement | null = null;

    onInit() {
        this.#lat = parseFloat(this.lat || '0');
        this.#lon = parseFloat(this.lon || '0');
        this.#geolocationService
            .getPosition()
            .pipe(takeUntil(this.#subject))
            .subscribe((position) => {
                if (position && position.success) {
                    this.#currentPosition = position;

                    if (!isNaN(position.heading)) {
                        this.#currentHeading = position.heading;
                    }

                    this.#updateCompassRose();
                }
            });
        this.#navigationTypeService
            .getObservable()
            .pipe(takeUntil(this.#subject))
            .subscribe((navigationType) => {
                this.#currentNavigationType = navigationType;
                this.#updateCompassRose();
            });
        this.#positionService
            .availabilityState()
            .pipe(
                switchMap((state) => {
                    if (state === AvailabilityState.ALLOWED) {
                        return this.#positionService.getCompassBearing();
                    }

                    return EMPTY;
                }),
                takeUntil(this.#subject)
            )
            .subscribe((bearing) => {
                this.#currentBearing = bearing;
                this.#updateCompassRose();
            });
    }

    ngOnDestroy() {
        this.#subject.next(null);
        this.#subject.complete();
    }

    #updateCompassRose() {
        if (!this.#currentNavigationType || !this.#currentPosition) {
            return;
        }

        let compassRoseAngle = 0;
        let directionArrowAngle = 0;
        const cheapRuler = new CheapRuler(this.#currentPosition.latitude, 'meters');
        const bearingToDestination = cheapRuler.bearing([this.#currentPosition.longitude, this.#currentPosition.latitude], [this.#lon, this.#lat]);

        switch (this.#currentNavigationType) {
            case NavigationType.COMPASS:
                compassRoseAngle = Math.round(this.#currentBearing);
                directionArrowAngle = Math.round(bearingToDestination + this.#currentBearing);
                break;

            case NavigationType.DIRECTION_OF_TRAVEL:
                compassRoseAngle = -Math.round(this.#currentHeading);
                directionArrowAngle = Math.round(bearingToDestination - this.#currentHeading);
                break;

            default:
                // North up
                directionArrowAngle = Math.round(bearingToDestination);
                break;
        }

        if (this.compassRose) {
            this.compassRose.style.transform = `rotate(${compassRoseAngle}deg)`;
        }

        if (this.directionArrow) {
            this.directionArrow.style.transform = `rotate(${directionArrowAngle}deg)`;
        }
    }
}
