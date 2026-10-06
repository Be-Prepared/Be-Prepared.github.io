import { AccessState } from '../services/access/access-controller';
import { component, css, html } from 'fudgel';
import { computeSkyReport, SkyReport } from './sky-report';
import { CoordinateService } from '../services/coordinate.service';
import {
    dayOffset,
    formatAltitude,
    looksLikeCoordinates,
    moonPhaseName,
    positionInDay,
    roundToMinute,
    SkyBand,
    splitDuration,
    toDateTimeLocalValue,
    bandForAltitude,
} from './sky-math';
import { di } from '../di';
import { DirectionService } from '../services/direction.service';
import { EMPTY_TIMELINE, TimelineView } from './sun-moon-timeline.component';
import { finalize, first, takeUntil } from 'rxjs/operators';
import { formatClock } from '../services/reminders/alarm-schedule';
import { GeolocationService } from '../services/geolocation.service';
import { I18nService } from '../i18n/i18n.service';
import { LatLon } from '../datatypes/lat-lon';
import { litOnRight } from './moon-drawing';
import { PreferenceService } from '../services/preference.service';
import { ReferenceLocationService } from '../services/reference-location.service';
import { Subject } from 'rxjs';
import { TimeService } from '../services/time.service';
import { ToastService } from '../services/toast.service';

interface SunRow {
    evening: string;
    hasTimes: boolean;
    label: string;
    morning: string;
    swatch: string;
}

interface Fact {
    label: string;
    value: string;
}

const BANDS: SkyBand[] = [
    'night',
    'astronomical',
    'nautical',
    'civil',
    'golden',
    'day',
];

// Keeps the countdowns right while the screen stays open.
const REFRESH_MS = 30 * 1000;

export class SunMoonAppComponent {
    private _coordinateService = di(CoordinateService);
    private _directionService = di(DirectionService);
    private _geolocationService = di(GeolocationService);
    private _i18nService = di(I18nService);
    private _language = navigator.language || 'en-US';
    private _preferenceService = di(PreferenceService);
    private _referenceLocationService = di(ReferenceLocationService);
    private _report: SkyReport | null = null;
    private _timer: ReturnType<typeof setInterval> | null = null;
    private _timeService = di(TimeService);
    private _toastService = di(ToastService);
    allowGetLocation = false;
    coordinates: LatLon | null = null;
    coordinatesText = '';
    dateInputValue = '';
    dateText = '';
    dateValue = new Date();
    editing = false;
    editorClass = 'editor';
    expanded = 'false';
    gettingLocation = false;
    live = true;
    locationText = '';
    moonCaption = '';
    moonFacts: Fact[] = [];
    moonFraction = 0;
    moonNote = '';
    moonPercent = '';
    moonPhaseLabel = '';
    moonRight = true;
    moonRiseText = '';
    moonSetText = '';
    nowTitle = '';
    placeTitle = '';
    positionRows: {
        altitude: string;
        direction: string;
        label: string;
        note: string;
    }[] = [];
    subject = new Subject();
    sunBandClass = '';
    sunBandLabel = '';
    sunBig = '';
    sunCaption = '';
    sunFacts: Fact[] = [];
    sunNote = '';
    moonHasTimes = true;
    placeClass = 'place-title';
    sunBigClass = 'big';
    sunRows: SunRow[] = [];
    sunStats: { icon: string; label: string; value: string }[] = [];
    timeSuffix = '';
    timeText = '';
    timeline: TimelineView = EMPTY_TIMELINE;
    timeZoneText = '';

    constructor() {
        this._geolocationService
            .availabilityState()
            .pipe(takeUntil(this.subject))
            .subscribe((state) => {
                this.allowGetLocation =
                    state === AccessState.PROMPT || state === AccessState.READY;
            });
        this._timeService
            .getCurrentSetting()
            .pipe(takeUntil(this.subject))
            .subscribe(() => this._render());
    }

    onInit() {
        const locationStr = this._preferenceService.sunMoonLocation.getItem();

        try {
            const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            this.timeZoneText = zone
                ? `${this._get('sunMoon.timeZoneNote')} ${zone}`
                : '';
        } catch (_ignore) {
            this.timeZoneText = '';
        }

        this._setEditing(!locationStr);
        this._render();

        if (locationStr) {
            this.locationText = locationStr;
            this.locationUpdate(locationStr);
        }

        this._timer = setInterval(() => {
            if (this.live) {
                this.dateValue = new Date();
                this._render();
            }
        }, REFRESH_MS);
    }

    onDestroy() {
        this.subject.next(null);
        this.subject.complete();

        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
    }

    backToNow() {
        this.live = true;
        this.dateValue = new Date();
        this._render();
    }

    closeEditor() {
        this._setEditing(false);
    }

    dateUpdate(value: string) {
        const date = new Date(value);

        if (!value || isNaN(date.getTime())) {
            this.backToNow();

            return;
        }

        this.live = false;
        this.dateValue = date;
        this._render();
    }

    toggleEditor() {
        this._setEditing(!this.editing || !this.coordinates);
    }

    toggleTimeSystem() {
        this._timeService.toggleSystem();
    }

    locationUpdate(value: string) {
        // Shorthand like "CWC8+R9" is completed using where you are.
        this._referenceLocationService
            .parseLocation(value, (isWaiting) => {
                this.gettingLocation = isWaiting;
            })
            .pipe(takeUntil(this.subject))
            .subscribe(({ latLon, usedReference, missingReference }) => {
                if (latLon) {
                    // Shorthand is saved as full coordinates so it means the
                    // same place the next time, wherever you are.
                    const saved = usedReference
                        ? `${latLon.lat} ${latLon.lon}`
                        : value;
                    this._preferenceService.sunMoonLocation.setItem(saved);
                    this.locationText = saved;
                    this.coordinates = latLon;
                    this._render();
                } else if (missingReference) {
                    this._toastService.popI18n('location.needReference');
                } else {
                    this._toastService.popI18n('sunMoon.locationNotFound');
                }
            });
    }

    getCurrentLocation() {
        this.gettingLocation = true;
        this._geolocationService
            .getPosition()
            .pipe(
                takeUntil(this.subject),
                first(),
                finalize(() => {
                    this.gettingLocation = false;
                })
            )
            .subscribe(
                (geolocation) => {
                    if (geolocation.success) {
                        const value = `${geolocation.lat} ${geolocation.lon}`;
                        this.locationText = value;
                        this.locationUpdate(value);
                    } else {
                        this._geolocationError();
                    }
                },
                () => {
                    this._geolocationError();
                }
            );
    }

    private _get(key: string) {
        return this._i18nService.get(key);
    }

    private _geolocationError() {
        this._toastService.popI18n('sunMoon.geolocationError');
    }

    private _setEditing(editing: boolean) {
        this.editing = editing;
        this.editorClass = editing ? 'editor' : 'editor hidden';
        this.expanded = `${editing}`;
    }

    // `expected` is "AM" or "PM": a 12-hour suffix that matches it is left
    // off, for columns already headed Morning or Evening.
    private _timeParts(time: number, expected = '') {
        const rounded = roundToMinute(time);
        const date = new Date(rounded);
        const clock = formatClock(
            date.getHours(),
            date.getMinutes(),
            this._timeService.isTwelveHour()
        );
        const offset = this._report
            ? dayOffset(rounded, this._report.dayStart)
            : 0;
        let day = '';

        if (offset > 0) {
            day = ` +${offset}`;
        } else if (offset < 0) {
            day = ` \u2212${-offset}`;
        }

        return {
            clock: clock.time,
            day,
            suffix:
                clock.suffix && clock.suffix !== expected
                    ? `\u00a0${this._get(`info.time12Hour.${clock.suffix}`)}`
                    : '',
        };
    }

    private _join(parts: ReturnType<SunMoonAppComponent['_timeParts']>) {
        return `${parts.clock}${parts.suffix}${parts.day}`;
    }

    // "07:05" or "7:05 AM". Times on another day than the one shown get
    // "+1" or "−1" unless showDay is false.
    private _time(time: number | null, showDay = true) {
        if (time === null) {
            return '\u2014';
        }

        const parts = this._timeParts(time);

        return `${parts.clock}${parts.suffix}${showDay ? parts.day : ''}`;
    }

    // "06:46–07:16", "6:46–7:16 AM"; an open end shows as "…".
    private _range(start: number | null, end: number | null, expected = '') {
        if (start === null && end === null) {
            return '\u2014';
        }

        if (start === null) {
            return `\u2026\u2013${this._join(this._timeParts(end!, expected))}`;
        }

        if (end === null) {
            return `${this._join(this._timeParts(start, expected))}\u2013\u2026`;
        }

        const a = this._timeParts(start, expected);
        const b = this._timeParts(end, expected);
        const startText =
            a.suffix === b.suffix && a.day === b.day ? a.clock : this._join(a);

        return `${startText}\u2013${this._join(b)}`;
    }

    private _duration(ms: number) {
        const { hours, minutes } = splitDuration(ms);
        const h = this._get('sunMoon.unitHour');
        const m = this._get('sunMoon.unitMinute');

        if (!hours) {
            return `${minutes} ${m}`;
        }

        if (!minutes) {
            return `${hours} ${h}`;
        }

        return `${hours} ${h} ${minutes} ${m}`;
    }

    private _date(time: number, options: Intl.DateTimeFormatOptions) {
        try {
            return new Intl.DateTimeFormat(this._language, options).format(
                new Date(time)
            );
        } catch (_ignore) {
            return new Date(time).toDateString();
        }
    }

    private _render() {
        const date = this.dateValue;
        const clock = formatClock(
            date.getHours(),
            date.getMinutes(),
            this._timeService.isTwelveHour()
        );
        this.timeText = clock.time;
        this.timeSuffix = clock.suffix
            ? ` ${this._get(`info.time12Hour.${clock.suffix}`)}`
            : '';
        const sameYear = date.getFullYear() === new Date().getFullYear();
        this.dateText = this._date(date.getTime(), {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: sameYear ? undefined : 'numeric',
        });
        this.dateInputValue = toDateTimeLocalValue(date);
        this.nowTitle = this.live
            ? this._get('sunMoon.nowTitle')
            : `${this._get('sunMoon.atTime')} ${this.timeText}${this.timeSuffix}`;

        if (!this.coordinates) {
            this._report = null;
            this.placeTitle = this._get('sunMoon.locationUnknown');

            return;
        }

        const { lat, lon } = this.coordinates;
        this.coordinatesText = this._coordinateService.latLonToSystemString(
            lat,
            lon
        );
        const isCoordinates = looksLikeCoordinates(this.locationText);
        this.placeTitle = isCoordinates
            ? this.coordinatesText
            : this.locationText.trim();
        this.placeClass = isCoordinates
            ? 'place-title coordinates'
            : 'place-title';
        const report = computeSkyReport(date, lat, lon);
        this._report = report;
        this._renderNow(report);
        this._renderTimeline(report);
        this._renderSun(report);
        this._renderMoon(report);
        this._renderPosition(report);
    }

    private _renderNow(report: SkyReport) {
        const band = bandForAltitude(report.sun.altitude);
        this.sunBandClass = `swatch band-${band}`;
        this.sunBandLabel = this._get(`sunMoon.band.${band}`);
        const next = report.sun.next;

        this.sunBigClass = next ? 'big' : 'big words';

        if (next) {
            this.sunBig = this._duration(next.time - report.time);
            this.sunCaption = `${this._get(
                next.rising ? 'sunMoon.untilSunrise' : 'sunMoon.untilSunset'
            )} · ${this._time(next.time, false)}`;
        } else if (report.sun.altitude > 0) {
            this.sunBig = this._get('sunMoon.midnightSun');
            this.sunCaption = this._get('sunMoon.noSunset24h');
        } else {
            this.sunBig = this._get('sunMoon.polarNight');
            this.sunCaption = this._get('sunMoon.noSunrise24h');
        }

        const moon = report.moon;
        this.moonFraction = moon.fraction;
        this.moonRight = litOnRight(moon.waxing, this.coordinates!.lat);
        this.moonPercent = `${Math.round(moon.fraction * 100)}%`;
        this.moonPhaseLabel = this._get(
            `sunMoon.moonIllumination.${moonPhaseName(moon.phase)}`
        );
        const moonNext = moon.next;

        if (moonNext) {
            this.moonCaption = `${this._get(
                moonNext.rising ? 'sunMoon.moonRises' : 'sunMoon.moonSets'
            )} ${this._time(moonNext.time, false)}`;
        } else {
            this.moonCaption = this._get(
                moon.altitude > 0
                    ? 'sunMoon.moonStaysUp'
                    : 'sunMoon.moonStaysDown'
            );
        }
    }

    private _renderTimeline(report: SkyReport) {
        const { dayStart, dayEnd } = report;
        const span = dayEnd - dayStart;
        const pct = (time: number) => ((time - dayStart) / span) * 100;
        const segments = report.segments.map((segment) => ({
            className: `band-${segment.band}`,
            style: `left: ${pct(segment.start)}%; width: ${
                pct(segment.end) - pct(segment.start)
            }%`,
        }));
        const events = [
            {
                time: report.sun.times.sunrise,
                icon: '/sunrise.svg',
                priority: 2,
            },
            { time: report.sun.times.solarNoon, icon: '/sun.svg', priority: 1 },
            { time: report.sun.times.sunset, icon: '/sunset.svg', priority: 2 },
        ]
            .map((e) => ({
                ...e,
                position:
                    e.time === null
                        ? null
                        : positionInDay(e.time, dayStart, dayEnd),
            }))
            .filter((e) => e.position !== null) as {
            time: number;
            icon: string;
            priority: number;
            position: number;
        }[];
        // Shifting each label by its own position keeps the ones near the
        // ends inside the bar.
        const place = (position: number) =>
            `left: ${position * 100}%; transform: translateX(-${
                position * 100
            }%)`;
        const labels = events.map((e) => ({
            icon: e.icon,
            position: e.position,
            priority: e.priority,
            style: place(e.position),
            text: this._time(e.time),
        }));
        const marks = events.map((e) => ({
            style: `left: ${e.position * 100}%`,
        }));
        const ticks = [0, 6, 12, 18, 24].map((hour) => {
            const start = new Date(dayStart);
            const time = new Date(
                start.getFullYear(),
                start.getMonth(),
                start.getDate(),
                hour
            ).getTime();
            const position = (time - dayStart) / span;
            const twelve = this._timeService.isTwelveHour();
            const h = hour % 24;
            let text = `${h}`.padStart(2, '0');

            if (hour === 24) {
                text = twelve ? text : '24';
            }

            if (twelve) {
                const suffix = this._get(
                    `info.time12Hour.${h >= 12 ? 'PM' : 'AM'}`
                );
                text = `${h % 12 || 12} ${suffix}`;
            }

            return { style: place(position), text };
        });
        const now = positionInDay(report.time, dayStart, dayEnd);
        this.timeline = {
            segments,
            labels,
            marks,
            nowStyle: `left: ${(now || 0) * 100}%`,
            showNow: now !== null,
            ticks,
            legend: BANDS.map((band) => ({
                className: `band-${band}`,
                label: this._get(`sunMoon.legend.${band}`),
            })),
        };
    }

    private _renderSun(report: SkyReport) {
        const t = report.sun.times;
        this.sunStats = [
            {
                icon: '/sunrise.svg',
                label: this._get('sunMoon.sunTimes.sunrise'),
                value: this._time(t.sunrise),
            },
            {
                icon: '/sun.svg',
                label: this._get('sunMoon.sunTimes.solarNoon'),
                value: this._time(t.solarNoon),
            },
            {
                icon: '/sunset.svg',
                label: this._get('sunMoon.sunTimes.sunset'),
                value: this._time(t.sunset),
            },
        ];
        this.sunNote = '';

        if (report.sun.alwaysUp) {
            this.sunNote = this._get('sunMoon.sunTimes.neverSet');
        } else if (report.sun.alwaysDown) {
            this.sunNote = this._get('sunMoon.sunTimes.neverRise');
        }

        const length = report.sun.dayLength;
        this.sunFacts = [
            {
                label: this._get('sunMoon.dayLength'),
                value: length === null ? '—' : this._duration(length),
            },
            {
                label: this._get('sunMoon.sunTimes.nadir'),
                value: this._time(t.nadir),
            },
        ];
        const row = (
            key: string,
            swatch: string,
            morning: [number | null, number | null],
            evening: [number | null, number | null]
        ): SunRow => ({
            evening: this._range(evening[0], evening[1], 'PM'),
            hasTimes: [...morning, ...evening].some((x) => x !== null),
            label: this._get(key),
            morning: this._range(morning[0], morning[1], 'AM'),
            swatch,
        });
        // Rows the sun never reaches today (polar day and night) are left
        // out; the note above says why.
        this.sunRows = [
            row(
                'sunMoon.sunTimes.sunriseSunset',
                'swatch sun-edge',
                [t.sunrise, t.sunriseEnd],
                [t.sunsetStart, t.sunset]
            ),
            row(
                'sunMoon.legend.golden',
                'swatch band-golden',
                [t.sunrise, t.goldenHourEnd],
                [t.goldenHour, t.sunset]
            ),
            row(
                'sunMoon.legend.civil',
                'swatch band-civil',
                [t.dawn, t.sunrise],
                [t.sunset, t.dusk]
            ),
            row(
                'sunMoon.legend.nautical',
                'swatch band-nautical',
                [t.nauticalDawn, t.dawn],
                [t.dusk, t.nauticalDusk]
            ),
            row(
                'sunMoon.legend.astronomical',
                'swatch band-astronomical',
                [t.nightEnd, t.nauticalDawn],
                [t.nauticalDusk, t.night]
            ),
        ].filter((r) => r.hasTimes);
    }

    private _renderMoon(report: SkyReport) {
        const moon = report.moon;
        const none = this._get('sunMoon.noneToday');
        this.moonRiseText = moon.rise === null ? none : this._time(moon.rise);
        this.moonSetText = moon.set === null ? none : this._time(moon.set);
        this.moonNote = '';
        this.moonHasTimes = !moon.alwaysUp && !moon.alwaysDown;

        if (moon.alwaysUp) {
            this.moonNote = this._get('sunMoon.moonTimes.alwaysUp');
        } else if (moon.alwaysDown) {
            this.moonNote = this._get('sunMoon.moonTimes.alwaysDown');
        }

        const when = (time: number | null) =>
            time === null
                ? '—'
                : `${this._date(time, {
                      month: 'short',
                      day: 'numeric',
                  })} · ${this._time(time, false)}`;
        this.moonFacts = [
            {
                label: this._get('sunMoon.moonIllumination.label'),
                value: this.moonPhaseLabel,
            },
            {
                label: this._get('sunMoon.illuminated'),
                value: this.moonPercent,
            },
            {
                label: this._get('sunMoon.nextNewMoon'),
                value: when(moon.nextNew),
            },
            {
                label: this._get('sunMoon.nextFullMoon'),
                value: when(moon.nextFull),
            },
        ];
    }

    private _renderPosition(report: SkyReport) {
        const row = (key: string, azimuth: number, altitude: number) => ({
            altitude: formatAltitude(altitude),
            direction: this._directionService.toHeadingDirection(azimuth),
            label: this._get(key),
            note: altitude < 0 ? this._get('sunMoon.belowHorizon') : '',
        });
        this.positionRows = [
            row('sunMoon.sun', report.sun.azimuth, report.sun.altitude),
            row('sunMoon.moon', report.moon.azimuth, report.moon.altitude),
        ];
    }
}

component(
    'sun-moon-app',
    {
        style: css`
            :host {
                --sky-night: #1b2547;
                --sky-astronomical: #2f4377;
                --sky-nautical: #4d6aa8;
                --sky-civil: #87a3d8;
                --sky-golden: #f4b54f;
                --sky-day: #bfe2f7;
                --sky-mark: rgba(20, 23, 28, 0.45);
                --moon-lit: #f4ecd2;
                --moon-dark: #3a414c;
                --moon-rim: #9aa3ae;
            }

            @media (prefers-color-scheme: dark) {
                :host {
                    --sky-night: #18224a;
                    --sky-astronomical: #263b75;
                    --sky-nautical: #3a5aa0;
                    --sky-civil: #6a8bd0;
                    --sky-golden: #d9963a;
                    --sky-day: #5a9fd4;
                    --sky-mark: rgba(242, 244, 247, 0.6);
                    --moon-lit: #efe6c8;
                    --moon-dark: #23272e;
                    --moon-rim: #4a525d;
                }
            }

            .page {
                display: flex;
                flex-direction: column;
                gap: var(--space-3);
                max-width: 64rem;
                margin: 0 auto;
                padding-bottom: var(--space-4);
            }

            .header {
                display: flex;
                flex-direction: column;
                gap: var(--space-1);
            }

            .place {
                display: flex;
                align-items: center;
                gap: var(--space-2);
                width: 100%;
                padding: 0;
                border: 0;
                background: none;
                color: inherit;
                font: inherit;
                text-align: left;
                cursor: pointer;
            }

            .place-icon {
                width: 1.6rem;
                height: 1.6rem;
                flex: none;
                color: var(--accent);
            }

            .place-title {
                flex: 1 1 auto;
                min-width: 0;
                font-size: 1.5rem;
                font-weight: 700;
                line-height: 1.2;
                overflow-wrap: anywhere;
            }

            .place-title.coordinates {
                font-size: 1.15rem;
                font-variant-numeric: tabular-nums;
            }

            .edit-icon {
                flex: none;
                width: 2.5rem;
                height: 2.5rem;
                padding: 0.55rem;
                box-sizing: border-box;
                border-radius: 50%;
                border: 1px solid var(--border);
                background: var(--surface);
                color: var(--fg);
            }

            .when {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: var(--space-1) var(--space-3);
                color: var(--fg-muted);
                padding-left: calc(1.6rem + var(--space-2));
            }

            .clock {
                color: var(--fg);
                font-weight: 600;
                font-variant-numeric: tabular-nums;
            }

            .now-button {
                border: 1px solid var(--accent);
                background: var(--accent-soft);
                color: var(--accent);
                border-radius: 999px;
                padding: 0.1rem 0.75rem;
                font: inherit;
                font-size: 0.85rem;
                font-weight: 600;
                cursor: pointer;
            }

            .editor {
                display: flex;
                flex-direction: column;
                gap: var(--space-2);
                background: var(--surface);
                border: 1px solid var(--border);
                border-radius: var(--radius-l);
                padding: var(--space-4);
                box-shadow: var(--shadow);
            }

            .editor.hidden {
                display: none;
            }

            .field-label {
                font-size: 0.85rem;
                font-weight: 600;
                color: var(--fg-muted);
            }

            .field {
                display: flex;
                align-items: center;
                gap: var(--space-2);
            }

            .field pretty-input {
                flex: 1 1 auto;
                min-width: 0;
            }

            .field pretty-button {
                flex: none;
            }

            .prompt {
                color: var(--fg-muted);
                margin: 0;
            }

            .grid {
                display: grid;
                gap: var(--space-3);
                grid-template-columns: repeat(
                    auto-fill,
                    minmax(min(100%, 21rem), 1fr)
                );
                align-items: start;
            }

            .card {
                background: var(--surface);
                border: 1px solid var(--border);
                border-radius: var(--radius-l);
                padding: var(--space-4);
                box-shadow: var(--shadow);
                min-width: 0;
            }

            .card-title {
                margin: 0 0 var(--space-3);
                font-size: 0.8rem;
                font-weight: 700;
                letter-spacing: 0.06em;
                text-transform: uppercase;
                color: var(--fg-muted);
            }

            .now-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: var(--space-4);
            }

            .now-moon {
                display: flex;
                align-items: center;
                gap: var(--space-2);
            }

            .now-moon moon-phase-icon {
                width: 2.1rem;
                height: 2.1rem;
            }

            .state {
                display: flex;
                align-items: center;
                gap: 0.4rem;
                font-weight: 600;
            }

            .big {
                font-size: clamp(1.3rem, 4.5vw + 0.35rem, 1.75rem);
                white-space: nowrap;
                font-weight: 700;
                line-height: 1.15;
                margin: var(--space-1) 0;
                font-variant-numeric: tabular-nums;
            }

            .big.words {
                font-size: 1.3rem;
                line-height: 1.25;
                white-space: normal;
            }

            .caption {
                color: var(--fg-muted);
                font-size: 0.9rem;
            }

            .swatch {
                display: inline-block;
                flex: none;
                width: 0.8rem;
                height: 0.8rem;
                border-radius: 3px;
                border: 1px solid var(--border);
                vertical-align: -0.05rem;
                margin-right: 0.35rem;
            }

            .state .swatch {
                margin-right: 0;
            }

            .band-night {
                background: var(--sky-night);
            }

            .band-astronomical {
                background: var(--sky-astronomical);
            }

            .band-nautical {
                background: var(--sky-nautical);
            }

            .band-civil {
                background: var(--sky-civil);
            }

            .band-golden {
                background: var(--sky-golden);
            }

            .band-day {
                background: var(--sky-day);
            }

            .sun-edge {
                background: linear-gradient(
                    to right,
                    var(--sky-civil) 50%,
                    var(--sky-golden) 50%
                );
            }

            .stats {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: var(--space-2);
                text-align: center;
            }

            .stats.two {
                grid-template-columns: repeat(2, 1fr);
            }

            .stat load-svg {
                display: block;
                width: 1.5rem;
                height: 1.5rem;
                margin: 0 auto;
                color: var(--fg-muted);
            }

            .stat-value {
                font-size: clamp(1rem, 3.6vw + 0.3rem, 1.35rem);
                font-weight: 700;
                font-variant-numeric: tabular-nums;
                white-space: nowrap;
            }

            .stat-label {
                font-size: 0.8rem;
                color: var(--fg-muted);
            }

            .note {
                margin-top: var(--space-3);
                padding: var(--space-2) var(--space-3);
                border-radius: var(--radius-s);
                background: var(--surface-2);
                font-size: 0.9rem;
            }

            .facts {
                margin-top: var(--space-3);
            }

            .fact {
                display: flex;
                justify-content: space-between;
                align-items: baseline;
                gap: var(--space-3);
                padding: 0.35rem 0;
                border-top: 1px solid var(--border);
            }

            .fact-label {
                color: var(--fg-muted);
                white-space: nowrap;
            }

            .fact-value {
                text-align: right;
                font-weight: 600;
                font-variant-numeric: tabular-nums;
            }

            table {
                width: 100%;
                border-collapse: collapse;
                font-size: 0.9rem;
                font-variant-numeric: tabular-nums;
            }

            .sun-table {
                margin-top: var(--space-3);
            }

            th,
            td {
                padding: 0.35rem 0;
                text-align: right;
                border-top: 1px solid var(--border);
            }

            thead th {
                border-top: 0;
                font-size: 0.75rem;
                font-weight: 600;
                color: var(--fg-muted);
                padding-top: 0;
            }

            tbody th {
                text-align: left;
                font-weight: 400;
                color: var(--fg-muted);
                padding-right: var(--space-2);
            }

            td {
                white-space: nowrap;
                padding-left: var(--space-2);
            }

            .row-label {
                display: flex;
                align-items: center;
                gap: 0.4rem;
            }

            .row-label .swatch {
                margin: 0;
            }

            .sun-table {
                font-size: 0.85rem;
            }

            .sun-table td {
                padding-left: 0.375rem;
            }

            .sun-table tbody th {
                padding-right: var(--space-1);
            }

            .position td {
                font-weight: 600;
                font-size: 1.05rem;
            }

            .cell-note {
                font-size: 0.75rem;
                font-weight: 400;
                color: var(--fg-muted);
            }

            .location-line {
                margin: 0 0 var(--space-2);
            }

            .muted {
                color: var(--fg-muted);
                font-size: 0.9rem;
            }

            .getting-location {
                display: flex;
                padding: var(--space-3) var(--space-4);
                background: var(--surface);
                border: 1px solid var(--border);
                border-radius: var(--radius-m);
            }

            /* Very small phones, such as 320px wide. */
            @media (max-width: 22rem) {
                .card {
                    padding: var(--space-3);
                }

                .sun-table {
                    font-size: 0.8rem;
                }
            }

            @media (min-width: 40rem) {
                .place-title {
                    font-size: 1.75rem;
                }
            }
        `,
        template: html`
            <default-layout>
                <div class="page">
                    <div class="header">
                        <button
                            class="place"
                            aria-expanded="{{expanded}}"
                            @click.stop.prevent="toggleEditor()"
                        >
                            <load-svg
                                class="place-icon"
                                href="/location.svg"
                            ></load-svg>
                            <span class="{{placeClass}}">{{placeTitle}}</span>
                            <load-svg
                                class="edit-icon"
                                href="/edit.svg"
                            ></load-svg>
                        </button>
                        <div class="when">
                            <span>{{dateText}}</span>
                            <changeable-setting
                                class="clock"
                                @click.stop.prevent="toggleTimeSystem()"
                                >{{timeText}}{{timeSuffix}}</changeable-setting
                            >
                            <button
                                *if="!live"
                                class="now-button"
                                @click.stop.prevent="backToNow()"
                            >
                                <i18n-label
                                    id="sunMoon.backToNow"
                                    ws=""
                                ></i18n-label>
                            </button>
                        </div>
                    </div>
                    <div class="{{editorClass}}">
                        <p *if="!coordinates" class="prompt">
                            <i18n-label
                                id="sunMoon.locationPrompt"
                                ws=""
                            ></i18n-label>
                        </p>
                        <label class="field-label">
                            <i18n-label
                                id="sunMoon.enterCoordinates"
                                ws=""
                            ></i18n-label>
                        </label>
                        <div class="field">
                            <pretty-input
                                type="text"
                                help-html="location.help.html"
                                .value="locationText"
                                @change.stop.prevent="locationUpdate($event.detail)"
                            ></pretty-input>
                            <icon-button
                                *if="allowGetLocation"
                                href="/location.svg"
                                label-id="sunMoon.useMyLocation"
                                @click.stop.prevent="getCurrentLocation()"
                            ></icon-button>
                        </div>
                        <label class="field-label">
                            <i18n-label
                                id="sunMoon.enterDate"
                                ws=""
                            ></i18n-label>
                        </label>
                        <div class="field">
                            <pretty-input
                                type="datetime-local"
                                .value="dateInputValue"
                                @change.stop.prevent="dateUpdate($event.detail)"
                            ></pretty-input>
                            <pretty-button
                                padding="0 var(--space-4)"
                                @click.stop.prevent="backToNow()"
                                ><i18n-label id="sunMoon.now" ws=""></i18n-label
                            ></pretty-button>
                        </div>
                        <pretty-button
                            *if="coordinates"
                            variant="primary"
                            @click.stop.prevent="closeEditor()"
                            ><i18n-label id="sunMoon.done" ws=""></i18n-label
                        ></pretty-button>
                    </div>
                    <div *if="coordinates" class="grid">
                        <section class="card">
                            <h2 class="card-title">{{nowTitle}}</h2>
                            <div class="now-grid">
                                <div>
                                    <div class="state">
                                        <span class="{{sunBandClass}}"></span>
                                        <span>{{sunBandLabel}}</span>
                                    </div>
                                    <div class="{{sunBigClass}}">
                                        {{sunBig}}
                                    </div>
                                    <div class="caption">{{sunCaption}}</div>
                                </div>
                                <div>
                                    <div class="state">{{moonPhaseLabel}}</div>
                                    <div class="big now-moon">
                                        <moon-phase-icon
                                            .fraction="moonFraction"
                                            .right="moonRight"
                                        ></moon-phase-icon>
                                        <span>{{moonPercent}}</span>
                                    </div>
                                    <div class="caption">{{moonCaption}}</div>
                                </div>
                            </div>
                        </section>
                        <section class="card">
                            <h2 class="card-title">
                                <i18n-label
                                    id="sunMoon.timelineTitle"
                                    ws=""
                                ></i18n-label>
                            </h2>
                            <sun-moon-timeline
                                .view="timeline"
                            ></sun-moon-timeline>
                        </section>
                        <section class="card">
                            <h2 class="card-title">
                                <i18n-label id="sunMoon.sun" ws=""></i18n-label>
                            </h2>
                            <div class="stats">
                                <div *for="stat of sunStats" class="stat">
                                    <load-svg href="{{stat.icon}}"></load-svg>
                                    <div class="stat-value">{{stat.value}}</div>
                                    <div class="stat-label">{{stat.label}}</div>
                                </div>
                            </div>
                            <div *if="sunNote" class="note">{{sunNote}}</div>
                            <div class="facts">
                                <div *for="fact of sunFacts" class="fact">
                                    <span class="fact-label"
                                        >{{fact.label}}</span
                                    >
                                    <span class="fact-value"
                                        >{{fact.value}}</span
                                    >
                                </div>
                            </div>
                            <table *if="sunRows.length" class="sun-table">
                                <thead>
                                    <tr>
                                        <th></th>
                                        <th>
                                            <i18n-label
                                                id="sunMoon.morning"
                                                ws=""
                                            ></i18n-label>
                                        </th>
                                        <th>
                                            <i18n-label
                                                id="sunMoon.evening"
                                                ws=""
                                            ></i18n-label>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr *for="row of sunRows">
                                        <th>
                                            <span class="row-label">
                                                <span
                                                    class="{{row.swatch}}"
                                                ></span>
                                                <span>{{row.label}}</span>
                                            </span>
                                        </th>
                                        <td>{{row.morning}}</td>
                                        <td>{{row.evening}}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </section>
                        <section class="card">
                            <h2 class="card-title">
                                <i18n-label
                                    id="sunMoon.moon"
                                    ws=""
                                ></i18n-label>
                            </h2>
                            <div *if="moonHasTimes" class="stats two">
                                <div class="stat">
                                    <div class="stat-value">
                                        {{moonRiseText}}
                                    </div>
                                    <div class="stat-label">
                                        <i18n-label
                                            id="sunMoon.moonTimes.rise"
                                            ws=""
                                        ></i18n-label>
                                    </div>
                                </div>
                                <div class="stat">
                                    <div class="stat-value">
                                        {{moonSetText}}
                                    </div>
                                    <div class="stat-label">
                                        <i18n-label
                                            id="sunMoon.moonTimes.set"
                                            ws=""
                                        ></i18n-label>
                                    </div>
                                </div>
                            </div>
                            <div *if="moonNote" class="note">{{moonNote}}</div>
                            <div class="facts">
                                <div *for="fact of moonFacts" class="fact">
                                    <span class="fact-label"
                                        >{{fact.label}}</span
                                    >
                                    <span class="fact-value"
                                        >{{fact.value}}</span
                                    >
                                </div>
                            </div>
                        </section>
                        <section class="card">
                            <h2 class="card-title">
                                <i18n-label
                                    id="sunMoon.position"
                                    ws=""
                                ></i18n-label>
                            </h2>
                            <table class="position">
                                <thead>
                                    <tr>
                                        <th></th>
                                        <th>
                                            <i18n-label
                                                id="sunMoon.direction"
                                                ws=""
                                            ></i18n-label>
                                        </th>
                                        <th>
                                            <i18n-label
                                                id="sunMoon.altitude"
                                                ws=""
                                            ></i18n-label>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr *for="row of positionRows">
                                        <th>{{row.label}}</th>
                                        <td>{{row.direction}}</td>
                                        <td>
                                            {{row.altitude}}
                                            <div
                                                *if="row.note"
                                                class="cell-note"
                                            >
                                                {{row.note}}
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </section>
                        <section class="card">
                            <h2 class="card-title">
                                <i18n-label
                                    id="sunMoon.location"
                                    ws=""
                                ></i18n-label>
                            </h2>
                            <p class="location-line">{{coordinatesText}}</p>
                            <nearest-major-city
                                .coordinates="coordinates"
                            ></nearest-major-city>
                            <p class="muted">{{timeZoneText}}</p>
                        </section>
                    </div>
                </div>
            </default-layout>
            <show-modal *if="gettingLocation">
                <div class="getting-location">
                    <i18n-label id="sunMoon.geolocation" ws=""></i18n-label>
                </div>
            </show-modal>
        `,
    },
    SunMoonAppComponent
);
