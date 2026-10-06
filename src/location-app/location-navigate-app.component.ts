import { AccessState } from '../services/access/access-controller';
import { component, css, emit, html } from 'fudgel';
import { di } from '../di';
import { first, switchMap, takeUntil } from 'rxjs/operators';
import {
    GeolocationCoordinateResultSuccess,
    GeolocationService,
} from '../services/geolocation.service';
import { PreferenceService } from '../services/preference.service';
import { EMPTY, Subject } from 'rxjs';
import { WakeLockService } from '../services/wake-lock.service';
import { WaypointSaved } from '../datatypes/waypoint-saved';
import { WaypointService } from './waypoint.service';

export class LocationNavigateAppComponent {
    private _enabled = false;
    private _geolocationService = di(GeolocationService);
    private _preferenceService = di(PreferenceService);
    private _subject = new Subject();
    private _wakeLockService = di(WakeLockService);
    private _waypointService = di(WaypointService);
    allowWakeLock = false;
    id?: string;
    startPosition: GeolocationCoordinateResultSuccess | null = null;
    startTime = Date.now();
    point: WaypointSaved | null = null;
    ready = false;
    wakeLockEnabled = false;

    onInit() {
        const id = this.id;

        if (id) {
            this.point = this._waypointService.getPoint(+id);
        }

        if (!this.point) {
            emit(this, 'edit', this.id);

            return;
        }

        if (this._wakeLockService.isSupported()) {
            this.allowWakeLock = true;

            if (
                this._preferenceService.navigationWakeLock.getItem() &&
                !this._enabled
            ) {
                this.toggleWakeLock();
            }
        }

        // Nothing here may start the GPS before permission is granted; the
        // prompt must come from the "Allow" button in location-wrapper.
        this._geolocationService
            .availabilityState()
            .pipe(
                switchMap((state) => {
                    this.ready = state === AccessState.READY;

                    if (!this.ready || this.startPosition) {
                        return EMPTY;
                    }

                    return this._geolocationService
                        .getPositionSuccess()
                        .pipe(first());
                }),
                // Last, so the inner position watch is stopped too.
                takeUntil(this._subject)
            )
            .subscribe((position) => (this.startPosition = position));
    }

    onDestroy() {
        if (this._enabled) {
            this._wakeLockService.release();
        }

        this._subject.next(null);
        this._subject.complete();
    }

    toggleWakeLock() {
        this._enabled = !this._enabled;
        this._preferenceService.navigationWakeLock.setItem(this._enabled);

        if (this._enabled) {
            this.wakeLockEnabled = true;
            this._wakeLockService.request();
        } else {
            this.wakeLockEnabled = false;
            this._wakeLockService.release();
        }
    }
}

component('location-navigate-app', {
    attr: ['id'],
    style: css`
        .navigate {
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
            gap: 10px;
        }

        .type-and-arrow {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            flex-grow: 1;
            text-align: center;
        }

        @media (orientation: portrait) {
            .type-and-arrow {
                width: 100%;
            }
        }

        @media (orientation: landscape) {
            .wrapper {
                flex-direction: row-reverse;
            }

            .buttons {
                flex-direction: column-reverse;
            }

            .content {
                flex-direction: row;
            }

            .type-and-arrow {
                height: 100%;
            }
        }

        .field {
            display: flex;
            max-width: 100%;
        }

        .fields {
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            max-width: 100%;
        }

        .navigation-arrow {
            flex-grow: 1;
            width: 100%;
        }

        .gap-above {
            padding-top: 0.4em;
        }

        .enabled {
            color: var(--button-fg-color-enabled);
        }
    `,
    template: html`
        <location-wrapper>
            <default-layout>
                <div *if="ready" class="content">
                    <div class="type-and-arrow">
                        <navigation-type></navigation-type>
                        <navigation-arrow
                            class="navigation-arrow"
                            lat="{{point.lat}}"
                            lon="{{point.lon}}"
                        ></navigation-arrow>
                    </div>
                    <div class="gap-above fields">
                        <div class="field">
                            <location-field
                                id="navigate.1"
                                default="DISTANCE"
                                lat="{{point.lat}}"
                                lon="{{point.lon}}"
                                start-time="{{startTime}}"
                                .start-position="startPosition"
                                name="{{point.name}}"
                            ></location-field>
                        </div>
                        <div class="field">
                            <location-field
                                id="navigate.2"
                                default="DESTINATION"
                                lat="{{point.lat}}"
                                lon="{{point.lon}}"
                                start-time="{{startTime}}"
                                .start-position="startPosition"
                                name="{{point.name}}"
                            ></location-field>
                        </div>
                        <div class="field">
                            <location-field
                                id="navigate.3"
                                default="SPEED"
                                lat="{{point.lat}}"
                                lon="{{point.lon}}"
                                start-time="{{startTime}}"
                                .start-position="startPosition"
                                name="{{point.name}}"
                            ></location-field>
                        </div>
                        <div class="field">
                            <location-field
                                id="navigate.4"
                                default="HEADING"
                                lat="{{point.lat}}"
                                lon="{{point.lon}}"
                                start-time="{{startTime}}"
                                .start-position="startPosition"
                                name="{{point.name}}"
                            ></location-field>
                        </div>
                        <div class="field">
                            <location-field
                                id="navigate.5"
                                default="ACCURACY"
                                lat="{{point.lat}}"
                                lon="{{point.lon}}"
                                start-time="{{startTime}}"
                                .start-position="startPosition"
                                name="{{point.name}}"
                            ></location-field>
                        </div>
                    </div>
                </div>
                <icon-button
                    slot="more-buttons"
                    *if="allowWakeLock"
                    .active="wakeLockEnabled"
                    @click.stop.prevent="toggleWakeLock()"
                    href="/wake-lock.svg"
                    label-id="location.keepScreenOn"
                ></icon-button>
            </default-layout>
        </location-wrapper>
    `,
}, LocationNavigateAppComponent);
