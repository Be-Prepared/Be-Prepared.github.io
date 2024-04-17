import { Component, css, di, html } from 'fudgel';
import {
    PositionService,
} from '../services/position.service';
import { Subscription } from 'rxjs';

@Component('compass-app', {
    style: css`
        @media screen and (orientation: landscape) {
            .wrapper {
                flex-direction: row-reverse;
            }
        }
        .wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            width: 100%;
        }
        .compassRose {
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
        .infoDegrees {
            flex-grow: 1;
            display: flex;
            font-size: 3em;
            align-items: center;
        }
        .buttons {
            width: 100%;
            display: flex;
            justify-content: space-between;
        }
    `,
    template: html`
        <div class="wrapper">
            <load-svg class="compassRose" href="/compass-rose.svg" #ref="compassRose"></load-svg>
            <div class="info">
                <div class="infoDegrees">
                    {{degrees}}° {{bearing}}
                </div>

                <div class="buttons">
                    <back-button></back-button>
                </div>
            </div>
        </div>
    `,
})
export class CompassAppComponent {
    #positionService = di(PositionService);
    #subscription?: Subscription;
    compassRose?: HTMLElement;
    degrees = 0;
    bearing = 'N';

    onInit() {
        this.#subscription = this.#positionService
            .getCompassHeading()
            .subscribe((heading: number) => {
                const rounded = Math.round(heading);
                this.degrees = rounded;
                this.bearing = this.#getBearing(rounded);

                if (this.compassRose) {
                    this.compassRose.style.transform = `rotate(${rounded}deg)`;
                }
            });
    }

    onDestroy() {
        if (this.#subscription) {
            this.#subscription.unsubscribe();
        }
    }

    #getBearing(degrees: number) {
        if (degrees < 22.5 || degrees >= 337.5) {
            return 'N';
        }

        if (degrees < 67.5) {
            return 'NE';
        }

        if (degrees < 112.5) {
            return 'E';
        }

        if (degrees < 157.5) {
            return 'SE';
        }

        if (degrees < 202.5) {
            return 'S';
        }

        if (degrees < 247.5) {
            return 'SW';
        }

        if (degrees < 292.5) {
            return 'W';
        }

        if (degrees < 337.5) {
            return 'NW';
        }

        return '?';
    }
}