import { Component, css, di, html } from 'fudgel';
import { CoordinateService, LatLon } from '../services/coordinate.service';
import { DirectionService } from '../services/direction.service';
import { DistanceService } from '../services/distance.service';

@Component('nearest-major-city', {
    prop: ['coordinates'],
    style: css``,
    template: html`
        <div *if="coordinates">
            <i18n-label id="sunMoon.nearestMajorCity.label"></i18n-label>
            {{nearestMajorCity}}
        </div>
    `,
})
export class NearestMajorCityComponent {
    private _coordinateService = di(CoordinateService);
    private _directionService = di(DirectionService);
    private _distanceService = di(DistanceService);
    coordinates: LatLon | null = null;
    nearestMajorCity: string | null = null;

    onChange(prop: string) {
        if (prop === 'coordinates' && this.coordinates) {
            this._coordinateService.getNearestMajorCity(
                this.coordinates.lat,
                this.coordinates.lon
            ).subscribe((nearest) => {
                const distance = this._distanceService.metersToString(
                    nearest.distance
                );
                const direction = this._directionService.toHeadingDirection(
                    nearest.bearing
                );

                this.nearestMajorCity = `${nearest.name} (${distance}, ${direction})`;
            });
        }
    }
}
