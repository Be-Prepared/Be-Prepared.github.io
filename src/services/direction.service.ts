export class DirectionService {
    // Measured from north to east, so 0 is north, Math.PI / 2 is east.
    radiansToDegreesNE(azimuth: number): number {
        return this.standardize360((azimuth * 180) / Math.PI);
    }

    // Measured from south to west, so 0 is south, Math.PI / 2 is west.
    radiansToDegreesSW(azimuth: number): number {
        return this.standardize360(180 + (azimuth * 180) / Math.PI);
    }

    // Direction is converted to [-180, 180).
    standardize180(direction: number) {
        if (direction >= -180 && direction < 180) {
            return direction;
        }

        if (direction >= 0 && direction < 360) {
            return direction - 180;
        }

        return this.standardize360(direction) - 180;
    }

    standardize360(direction: number) {
        if (direction >= 0 && direction < 360) {
            return direction;
        }

        return ((direction % 360) + 360) % 360;
    }

    toHeading(direction: number): string {
        if (isNaN(direction)) {
            return '';
        }

        const rounded = Math.round(direction);

        return `${rounded}°`;
    }

    toHeadingDirection(direction: number, precision = 2): string {
        if (isNaN(direction)) {
            return '';
        }

        const rounded = Math.round(direction);

        return `${this.toHeading(rounded)} ${this.toCompassPoint(rounded, precision)}`;
    }

    toCompassPoint(direction: number, precision = 2) {
        // Thanks to https://github.com/chrisveness/geodesy/blob/master/dms.js
        precision = Math.max(1, Math.min(3, Math.floor(precision)));
        direction = this.standardize360(direction);
        const cardinals = [
            'N',
            'NNE',
            'NE',
            'ENE',
            'E',
            'ESE',
            'SE',
            'SSE',
            'S',
            'SSW',
            'SW',
            'WSW',
            'W',
            'WNW',
            'NW',
            'NNW',
        ];
        const n = 2 * 2 ** precision;
        const cardinal =
            cardinals[((Math.round((direction * n) / 360) % n) * 16) / n];

        return cardinal;
    }
}
