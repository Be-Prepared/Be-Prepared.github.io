import { Component, css, html } from 'fudgel';
import { LatLon } from '../datatypes/lat-lon';
import { default as SunCalc } from 'suncalc';

@Component('sun-times', {
    prop: ['coordinates', 'date'],
    style: css``,
    template: html`
        <div *if="coordinates">
            <display-time
                id="sunMoon.sunTimes.nadir"
                .time="nadir"
            ></display-time>
            <display-time
                id="sunMoon.sunTimes.nightEnd"
                .time="nightEnd"
            ></display-time>
            <display-time
                id="sunMoon.sunTimes.nauticalDawn"
                .time="nauticalDawn"
            ></display-time>
            <display-time
                id="sunMoon.sunTimes.dawn"
                .time="dawn"
            ></display-time>
            <display-time
                id="sunMoon.sunTimes.sunrise"
                fail-id="sunMoon.sunTimes.neverRise"
                .time="sunrise"
            ></display-time>
            <display-time
                id="sunMoon.sunTimes.sunriseEnd"
                .time="sunriseEnd"
            ></display-time>
            <display-time
                id="sunMoon.sunTimes.goldenHourEnd"
                .time="goldenHourEnd"
            ></display-time>
            <display-time
                id="sunMoon.sunTimes.solarNoon"
                .time="solarNoon"
            ></display-time>
            <display-time
                id="sunMoon.sunTimes.goldenHour"
                .time="goldenHour"
            ></display-time>
            <display-time
                id="sunMoon.sunTimes.sunsetStart"
                .time="sunsetStart"
            ></display-time>
            <display-time
                id="sunMoon.sunTimes.sunset"
                fail-id="sunMoon.sunTimes.neverSet"
                .time="sunset"
            ></display-time>
            <display-time
                id="sunMoon.sunTimes.dusk"
                .time="dusk"
            ></display-time>
            <display-time
                id="sunMoon.sunTimes.nauticalDusk"
                .time="nauticalDusk"
            ></display-time>
            <display-time
                id="sunMoon.sunTimes.night"
                .time="night"
            ></display-time>
        </div>
    `,
})
export class SunTimesComponent {
    coordinates: LatLon | null = null;
    date: Date | null = null;
    dawn?: Date;
    dusk?: Date;
    goldenHour?: Date;
    goldenHourEnd?: Date;
    nadir?: Date;
    nauticalDawn?: Date;
    nauticalDusk?: Date;
    night?: Date;
    nightEnd?: Date;
    solarNoon?: Date;
    sunrise?: Date;
    sunriseEnd?: Date;
    sunset?: Date;
    sunsetStart?: Date;

    onChange(prop: string) {
        if (!this.coordinates || !this.date) {
            return;
        }

        if (prop === 'coordinates' || prop === 'date') {
            const times = SunCalc.getTimes(
                this.date,
                this.coordinates.lat,
                this.coordinates.lon
            );
            this.sunrise = times.sunrise;
            this.sunriseEnd = times.sunriseEnd;
            this.goldenHourEnd = times.goldenHourEnd;
            this.solarNoon = times.solarNoon;
            this.goldenHour = times.goldenHour;
            this.sunsetStart = times.sunsetStart;
            this.sunset = times.sunset;
            this.dusk = times.dusk;
            this.nauticalDusk = times.nauticalDusk;
            this.night = times.night;
            this.nadir = times.nadir;
            this.nightEnd = times.nightEnd;
            this.nauticalDawn = times.nauticalDawn;
            this.dawn = times.dawn;
        }
    }

    _parseTime(date: Date): string {
        return date.toLocaleString();
    }
}
