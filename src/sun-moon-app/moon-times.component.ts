import { Component, css, html } from 'fudgel';
import { LatLon } from '../services/coordinate.service';
import { default as SunCalc } from 'suncalc';

@Component('moon-times', {
    prop: ['coordinates'],
    style: css``,
    template: html`
        <div *if="coordinates">
            <i18n-label
                *if="alwaysUp"
                id="sunMoon.moonTimes.alwaysUp"
            ></i18n-label>
            <i18n-label
                *if="alwaysDown"
                id="sunMoon.moonTimes.alwaysDown"
            ></i18n-label>
            <div *if="!alwaysUp && !alwaysDown">
                <display-time
                    id="sunMoon.moonTimes.rise"
                    fail-id="sunMoon.moonTimes.neverRise"
                    .time="moonRise"
                ></display-time>
                <display-time
                    id="sunMoon.moonTimes.set"
                    fail-id="sunMoon.moonTimes.neverSet"
                    .time="moonSet"
                ></display-time>
            </div>
        </div>
    `,
})
export class MoonTimesComponent {
    coordinates: LatLon | null = null;
    alwaysDown: boolean = false;
    alwaysUp: boolean = false;
    moonRise?: Date;
    moonRiseTime?: string;
    moonSet?: Date;
    moonSetTime?: string;

    onChange(prop: string) {
        if (prop === 'coordinates' && this.coordinates) {
            const times = SunCalc.getMoonTimes(
                new Date(),
                this.coordinates.lat,
                this.coordinates.lon
            );
            this.alwaysUp = !!times.alwaysUp;
            this.alwaysDown = !!times.alwaysDown;
            this.moonRise = times.rise;
            this.moonSet = times.set;

            if (this.moonRise) {
                this.moonRiseTime = this._parseTime(this.moonRise);
            }

            if (this.moonSet) {
                this.moonSetTime = this._parseTime(this.moonSet);
            }
        }
    }

    _parseTime(date: Date): string {
        return date.toLocaleString();
    }
}
