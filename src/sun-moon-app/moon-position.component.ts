import { Component, css, di, html } from 'fudgel';
import { DirectionService } from '../services/direction.service';
import { LatLon } from '../services/coordinate.service';
import { default as SunCalc } from 'suncalc';

@Component('moon-position', {
    prop: ['coordinates'],
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
    moonPosition: string | null = null;

    onChange(prop: string) {
        if (prop === 'coordinates' && this.coordinates) {
            const moonPosition = SunCalc.getMoonPosition(
                new Date(),
                this.coordinates.lat,
                this.coordinates.lon
            );
            const bearing = this._directionService.radiansToDegreesSW(moonPosition.azimuth);
            const bearingStr = this._directionService.toHeadingDirection(bearing);
            const altitude = this._directionService.radiansToDegreesNE(moonPosition.altitude);
            const altitudeStr = this._directionService.toHeading(altitude);
            this.moonPosition = `${bearingStr}, +${altitudeStr}`;
        }
    }
}
