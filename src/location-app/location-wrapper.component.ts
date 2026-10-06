import { AccessState } from '../services/access/access-controller';
import { component, css, html } from 'fudgel';
import { di } from '../di';
import { GeolocationService } from '../services/geolocation.service';
import { of, Subject } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';

export class LocationWrapperComponent {
    private _geolocationService = di(GeolocationService);
    private _subject = new Subject();
    control = 'current';
    screenState = AccessState.CHECKING;
    waypointId?: number;

    onInit() {
        this._geolocationService
            .availabilityState()
            .pipe(
                switchMap((value) => {
                    this.screenState = value;

                    if (value === AccessState.READY) {
                        return this._geolocationService.getPosition();
                    }

                    return of(null);
                }),
                // Last, so the inner position watch is stopped too.
                takeUntil(this._subject)
            )
            .subscribe();
    }

    onDestroy() {
        this._subject.next(null);
        this._subject.complete();
    }

    grant() {
        this._geolocationService.request();
    }

    setControl(control: string, waypointId?: number) {
        // Set the waypoint first so the control can access it
        this.waypointId = waypointId;

        // Next, update the control
        this.control = control;
    }
}

component('location-wrapper', {
    style: css`
        .full {
            height: 100%;
            width: 100%;
            font-size: 3em;
        }

        @media (max-width: 960px) {
            .full {
                font-size: 2.5em;
            }
        }

        @media (max-width: 720px) {
            .full {
                font-size: 1.8em;
            }
        }

        @media (max-width: 480px) {
            .full {
                font-size: 1.3em;
            }
        }

        @media (max-width: 360px) {
            .full {
                font-size: 1em;
            }
        }

        @media (orientation: landscape) {
            @media (max-height: 720px) {
                .full {
                    font-size: 2em;
                }
            }

            .wrapper {
                flex-direction: row-reverse;
            }

            .buttons {
                flex-direction: column-reverse;
            }

            @media (max-width: 960px) {
                .full {
                    font-size: 1.3em;
                }
            }

            @media (max-width: 720px) {
                .full {
                    font-size: 1.2em;
                }
            }

            @media (max-width: 480px) {
                .full {
                    font-size: 1.1em;
                }
            }

            @media (max-width: 360px) {
                .full {
                    font-size: 1em;
                }
            }
        }
    `,
    template: html`
        <access-screen
            *if="screenState !== 'READY'"
            state="{{screenState}}"
            icon="/location.svg"
            message-id="location.explainAsk"
            unavailable-id="location.unavailableMessage"
            @grant.stop.prevent="grant()"
        ></access-screen>
        <div *if="screenState === 'READY'" class="full">
            <slot></slot>
        </div>
    `,
    useShadow: true,
}, LocationWrapperComponent);
