import { Component, css, html } from 'fudgel';
import { di } from '../di';
import { DirectionService } from '../services/direction.service';
import { LatLon } from '../datatypes/lat-lon';
import { default as SunCalc } from 'suncalc';

@Component('moon-position', {
    prop: ['coordinates', 'date'],
    style: css``,
    template: html`
        <div *if="coordinates">
            <i18n-label id="sunMoon.moonPosition.label"></i18n-label>
            {{moonPosition}}
        </div>
    `,
})
export class MoonPositionComponent {
    private _directionService = di(DirectionService);
    coordinates: LatLon | null = null;
    date: Date | null = null;
    moonPosition: string | null = null;

    onChange(prop: string) {
        if (!this.coordinates || !this.date) {
            return;
        }

        if (prop === 'coordinates' || prop === 'date') {
            const moonPosition = SunCalc.getMoonPosition(
                this.date,
                this.coordinates.lat,
                this.coordinates.lon
            );
            const bearing = this._directionService.radiansToDegreesSW(
                moonPosition.azimuth
            );
            const bearingStr =
                this._directionService.toHeadingDirection(bearing);
            const altitude = this._directionService.radiansToDegreesNW(
                moonPosition.altitude
            );
            const altitudeStr = this._directionService.toHeading(altitude);
            this.moonPosition = `${bearingStr}, +${altitudeStr}`;
        }
    }
}
