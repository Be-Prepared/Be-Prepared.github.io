import { AvailabilityState } from '../datatypes/availability-state';
import { Component, css, html } from 'fudgel';
import { di } from '../di';
import { GeolocationService } from '../services/geolocation.service';
import { of, Subject } from 'rxjs';
import { PermissionsService } from '../services/permissions.service';
import { switchMap, takeUntil } from 'rxjs/operators';

@Component('location-wrapper', {
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
        <permission-prompt
            *if="explainAsk"
            @grant.stop.prevent="grant()"
            message-id="location.explainAsk"
        ></permission-prompt>
        <permission-denied *if="explainDeny"></permission-denied>
        <location-unavailable *if="explainUnavailable"></location-unavailable>
        <permission-error *if="explainError"></permission-error>
        <div *if="showControls" class="full">
            <slot></slot>
        </div>
    `,
    useShadow: true,
})
export class LocationWrapperComponent {
    private _geolocationService = di(GeolocationService);
    private _permissionsService = di(PermissionsService);
    private _subject = new Subject();
    control = 'current';
    explainAsk = false;
    explainDeny = false;
    explainError = false;
    explainUnavailable = false;
    showControls = false;
    waypointId?: number;

    onInit() {
        this._geolocationService
            .availabilityState()
            .pipe(
                takeUntil(this._subject),
                switchMap((value) => {
                    this.explainAsk = value === AvailabilityState.PROMPT;
                    this.explainDeny = value === AvailabilityState.DENIED;
                    this.explainUnavailable =
                        value === AvailabilityState.UNAVAILABLE;
                    this.explainError = value === AvailabilityState.ERROR;
                    this.showControls = value === AvailabilityState.ALLOWED;

                    if (this.showControls) {
                        return this._geolocationService.getPosition();
                    }

                    return of(null);
                })
            )
            .subscribe();
    }

    onDestroy() {
        this._subject.next(null);
        this._subject.complete();
    }

    grant() {
        this.explainAsk = false;
        this._permissionsService.geolocation(true);
    }

    setControl(control: string, waypointId?: number) {
        // Set the waypoint first so the control can access it
        this.waypointId = waypointId;

        // Next, update the control
        this.control = control;
    }
}
