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
        }

        .container {
            position: absolute;
            aspect-ratio: 1/1;
            margin: auto;
            inset: 0;
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
            color: var(--navigate-color);
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
    private _geolocationService = di(GeolocationService);
    private _currentPosition: GeolocationCoordinateResultSuccess | null = null;
    private _currentBearing = 0;
    private _currentHeading = 0;
    private _currentNavigationType: NavigationType | null = null;
    private _lat = 0;
    private _lon = 0;
    private _navigationTypeService = di(NavigationTypeService);
    private _positionService = di(PositionService);
    private _subject = new Subject();
    compassRose: HTMLElement | null = null;
    lat?: string;
    lon?: string;
    directionArrow: HTMLElement | null = null;

    onInit() {
        this._lat = parseFloat(this.lat || '0');
        this._lon = parseFloat(this.lon || '0');
        this._geolocationService
            .getPosition()
            .pipe(takeUntil(this._subject))
            .subscribe((position) => {
                if (position && position.success) {
                    this._currentPosition = position;

                    if (!isNaN(position.heading)) {
                        this._currentHeading = position.heading;
                    }

                    this._updateCompassRose();
                }
            });
        this._navigationTypeService
            .getObservable()
            .pipe(takeUntil(this._subject))
            .subscribe((navigationType) => {
                this._currentNavigationType = navigationType;
                this._updateCompassRose();
            });
        this._positionService
            .availabilityState()
            .pipe(
                switchMap((state) => {
                    if (state === AvailabilityState.ALLOWED) {
                        return this._positionService.getCompassBearing();
                    }

                    return EMPTY;
                }),
                takeUntil(this._subject)
            )
            .subscribe((bearing) => {
                this._currentBearing = bearing;
                this._updateCompassRose();
            });
    }

    ngOnDestroy() {
        this._subject.next(null);
        this._subject.complete();
    }

    private _updateCompassRose() {
        if (!this._currentNavigationType || !this._currentPosition) {
            return;
        }

        let compassRoseAngle = 0;
        let directionArrowAngle = 0;
        const cheapRuler = new CheapRuler(
            this._currentPosition.latitude,
            'meters'
        );
        const bearingToDestination = cheapRuler.bearing(
            [this._currentPosition.longitude, this._currentPosition.latitude],
            [this._lon, this._lat]
        );

        switch (this._currentNavigationType) {
            case NavigationType.COMPASS:
                compassRoseAngle = Math.round(this._currentBearing);
                directionArrowAngle = Math.round(
                    bearingToDestination + this._currentBearing
                );
                break;

            case NavigationType.DIRECTION_OF_TRAVEL:
                compassRoseAngle = -Math.round(this._currentHeading);
                directionArrowAngle = Math.round(
                    bearingToDestination - this._currentHeading
                );
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
