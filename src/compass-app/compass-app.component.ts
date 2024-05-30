import { AvailabilityState } from '../datatypes/availability-state';
import { CompassService } from '../services/compass.service';
import { Component, css, di, html } from 'fudgel';
import { DirectionService } from '../services/direction.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

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
        <permission-prompt
            *if="explainAsk"
            @grant.stop.prevent="grant()"
            message-id="barcodeReader.explainAsk"
        ></permission-prompt>
        <permission-denied *if="explainDeny"></permission-denied>
        <compass-unavailable *if="explainUnavailable"></compass-unavailable>
        <default-layout *if="showControls">
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
    private _compassService = di(CompassService);
    private _directionService = di(DirectionService);
    private _subject = new Subject();
    compassRose?: HTMLElement;
    degrees = 0;
    explainAsk = false;
    explainDeny = false;
    explainUnavailable = false;
    headingDirection = '';
    showControls = false;

    onInit() {
        this._compassService
            .availabilityState()
            .pipe(takeUntil(this._subject))
            .subscribe((value) => {
                this.explainAsk = value === AvailabilityState.PROMPT;
                this.explainDeny = value === AvailabilityState.DENIED;
                this.explainUnavailable =
                    value === AvailabilityState.UNAVAILABLE;
                this.showControls = value === AvailabilityState.ALLOWED;
            });
        this._compassService
            .getCompassBearing()
            .pipe(takeUntil(this._subject))
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
        this._subject.next(null);
        this._subject.complete();
    }

    grant() {
        this.explainAsk = false;
        this._compassService.prompt();
    }
}
