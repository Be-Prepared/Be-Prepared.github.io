import { AccessState } from '../services/access/access-controller';
import { component, css, html } from 'fudgel';
import { di } from '../di';
import { filter, switchMap } from 'rxjs/operators';
import {
    GeolocationCoordinateResult,
    GeolocationService,
} from '../services/geolocation.service';
import { LatLon } from '../datatypes/lat-lon';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export class LocationAppComponent {
    private _geolocationService = di(GeolocationService);
    private _subject = new Subject();
    latLon: LatLon | null = null;
    position: GeolocationCoordinateResult | null = null;

    onInit() {
        this._geolocationService
            .availabilityState()
            .pipe(
                filter((state) => {
                    return state === AccessState.READY;
                }),
                switchMap(() => {
                    return this._geolocationService.getPosition();
                }),
                // Last, so the inner position watch is stopped too.
                takeUntil(this._subject)
            )
            .subscribe((position) => {
                this.position = position;
                this._redraw();
            });
    }

    onDestroy() {
        this._subject.next(null);
        this._subject.complete();
    }

    goToList() {
        history.pushState({}, document.title, '/location-list');
    }

    private _redraw() {
        if (this.position && this.position.success) {
            this.latLon = {
                lat: this.position.lat,
                lon: this.position.lon,
            };
        } else {
            this.latLon = null;
        }
    }
}

component('location-app', {
    style: css`
        .content {
            height: 100%;
            width: 100%;
            max-width: 34rem;
            margin: 0 auto;
            padding: var(--space-4);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: stretch;
            gap: var(--space-3);
            box-sizing: border-box;
            overflow: hidden;
            text-align: center;
        }

        @media (orientation: landscape) {
            .content.reading {
                flex-direction: row;
                align-items: center;
                max-width: 60rem;
            }

            .content.reading > * {
                flex: 1;
                min-width: 0;
            }
        }

        .card {
            box-sizing: border-box;
            padding: var(--space-3) var(--space-4);
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-l);
        }

        .coordinates {
            font-weight: 600;
            font-variant-numeric: tabular-nums;
        }

        /* Rows of readings, smaller than the coordinates above them. */
        .fields {
            display: flex;
            flex-direction: column;
            font-size: 0.7em;
        }

        .fields > div {
            padding: var(--space-2) 0;
        }

        .fields > div + div {
            border-top: 1px solid var(--border);
        }

        p {
            margin: 0;
            color: var(--fg-muted);
        }
    `,
    template: html`
        <location-wrapper>
            <default-layout>
                <div *if="latLon" class="content reading">
                    <div class="card coordinates">
                        <location-coordinates
                            .coords="latLon"
                        ></location-coordinates>
                    </div>
                    <div class="card fields">
                    <div>
                        <location-field
                            id="current.1"
                            default="ACCURACY"
                        ></location-field>
                    </div>
                    <div>
                        <location-field
                            id="current.2"
                            default="SPEED"
                        ></location-field>
                    </div>
                    <div>
                        <location-field
                            id="current.3"
                            default="HEADING"
                        ></location-field>
                    </div>
                    <div>
                        <location-field
                            id="current.4"
                            default="ALTITUDE"
                        ></location-field>
                    </div>
                    <div>
                        <location-field
                            id="current.5"
                            default="ALTITUDE_ACCURACY"
                        ></location-field>
                    </div>
                    </div>
                </div>
                <div *if="position && position.error" class="content">
                    <p>
                        <i18n-label id="location.positionError"></i18n-label>
                    </p>
                    <p
                        *if="position.error.code === position.error.PERMISSION_DENIED"
                    >
                        <i18n-label id="location.positionDenied"></i18n-label>
                    </p>
                    <p
                        *if="position.error.code === position.error.POSITION_UNAVAILABLE"
                    >
                        <i18n-label
                            id="location.positionUnavailable"
                        ></i18n-label>
                    </p>
                </div>
                <div *if="!position" class="content">
                    <p>
                        <i18n-label
                            id="location.retrievingLocation"
                        ></i18n-label>
                    </p>
                </div>
                <icon-button
                    slot="more-buttons"
                    @click="goToList()"
                    href="/list.svg"
                    label-id="location.waypointList"
                ></icon-button>
            </default-layout>
        </location-wrapper>
    `,
}, LocationAppComponent);
