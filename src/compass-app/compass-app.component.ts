import { Component, css, di, html } from 'fudgel';
import { DirectionService } from '../services/direction.service';
import { PositionService } from '../services/position.service';
import { Subscription } from 'rxjs';

@Component('compass-app', {
    style: css`
        .wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-evenly;
            height: 100%;
            width: 100%;
            overflow: hidden;
        }

        @media (orientation: landscape) {
            .wrapper {
                flex-direction: row;
            }
        }

        .compass-rose {
            padding: 2em;
            height: min(80vh, 80vw);
            width: min(80vh, 80vw);
            aspect-ratio: 1/1;
        }

        .info {
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            width: 100%;
            height: 100%;
        }

        .info-degrees {
            flex-grow: 1;
            display: flex;
            font-size: 3em;
            align-items: center;
        }
    `,
    template: html`
        <default-layout>
            <div class="wrapper">
                <load-svg
                    class="compass-rose"
                    href="/compass-rose.svg"
                    #ref="compassRose"
                ></load-svg>
                <div class="info">
                    <div class="info-degrees">{{headingDirection}}</div>
                </div>
            </div>
        </default-layout>
    `,
})
export class CompassAppComponent {
    private _directionService = di(DirectionService);
    private _positionService = di(PositionService);
    private _subscription?: Subscription;
    compassRose?: HTMLElement;
    degrees = 0;
    headingDirection = '';

    onInit() {
        this._subscription = this._positionService
            .getCompassBearing()
            .subscribe((bearing: number) => {
                const rounded = this._directionService.standardize360(
                    Math.round(bearing)
                );
                this.headingDirection =
                    this._directionService.toHeadingDirection(bearing);

                if (this.compassRose) {
                    this.compassRose.style.transform = `rotate(-${rounded}deg)`;
                }
            });
    }

    onDestroy() {
        if (this._subscription) {
            this._subscription.unsubscribe();
        }
    }
}
