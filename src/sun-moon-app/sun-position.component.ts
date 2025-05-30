import { Component, css, html } from 'fudgel';
import { di } from '../di';
import { DirectionService } from '../services/direction.service';
import { LatLon } from '../datatypes/lat-lon';
import { default as SunCalc } from 'suncalc';

@Component('sun-position', {
    prop: ['coordinates', 'date'],
    style: css``,
    template: html`
        <div *if="coordinates">
            <i18n-label id="sunMoon.sunPosition.label"></i18n-label>
            {{sunPosition}}
        </div>
    `,
})
export class SunPositionComponent {
    private _directionService = di(DirectionService);
    coordinates: LatLon | null = null;
    date: Date | null = null;
    sunPosition: string | null = null;

    onChange(prop: string) {
        if (!this.date || !this.coordinates) {
            return;
        }

        if (prop === 'date' || prop === 'coordinates') {
            const sunPosition = SunCalc.getPosition(
                this.date,
                this.coordinates.lat,
                this.coordinates.lon
            );
            const bearing = this._directionService.radiansToDegreesSW(
                sunPosition.azimuth
            );
            const bearingStr =
                this._directionService.toHeadingDirection(bearing);
            const altitude = this._directionService.radiansToDegreesNW(
                sunPosition.altitude
            );
            const altitudeStr = this._directionService.toHeading(altitude);
            this.sunPosition = `${bearingStr}, +${altitudeStr}`;
        }
    }
}
