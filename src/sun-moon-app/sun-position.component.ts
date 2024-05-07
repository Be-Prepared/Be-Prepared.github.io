import { Component, css, di, html } from 'fudgel';
import { DirectionService } from '../services/direction.service';
import { LatLon } from '../services/coordinate.service';
import { default as SunCalc } from 'suncalc';

@Component('sun-position', {
    prop: ['coordinates'],
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
    sunPosition: string | null = null;

    onChange(prop: string) {
        if (prop === 'coordinates' && this.coordinates) {
            const sunPosition = SunCalc.getPosition(
                new Date(),
                this.coordinates.lat,
                this.coordinates.lon
            );
            const bearing = this._directionService.radiansToDegreesSW(sunPosition.azimuth);
            const bearingStr = this._directionService.toHeadingDirection(bearing);
            const altitude = this._directionService.radiansToDegreesNE(sunPosition.altitude);
            const altitudeStr = this._directionService.toHeading(altitude);
            this.sunPosition = `${bearingStr}, +${altitudeStr}`;
        }
    }
}
