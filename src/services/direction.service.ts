export class DirectionService {
    // Measured from north to west, so 0 is north, Math.PI / 2 is west.
    radiansToDegreesNW(azimuth: number): number {
        return this.standardize360(360 - (azimuth * 180) / Math.PI);
    }

    // Measured from south to west, so 0 is south, Math.PI / 2 is west.
    radiansToDegreesSW(azimuth: number): number {
        return this.standardize360(180 + (azimuth * 180) / Math.PI);
    }

    // Direction is converted to [-180, 180) - used for longitude. -181 becomes
    // 179 from wrapping around.
    standardize180(direction: number) {
        if (direction >= -180 && direction < 180) {
            return direction;
        }

        // A lot of directions will fall into the [0-360) range.
        if (direction >= 180 && direction < 360) {
            return -360 + direction;
        }

        const deg360 = this.standardize360(direction);

        if (deg360 < 180) {
            return deg360;
        }

        return -360 + deg360;
    }

    standardize360(direction: number) {
        if (direction >= 0 && direction < 360) {
            return direction;
        }

        return ((direction % 360) + 360) % 360;
    }

    // Direction is converted to [-90, 90] for latitude.
    standardizeLatitude(direction: number) {
        while (direction < -90) {
            direction = -180 - direction;
        }

        while (direction > 90) {
            direction = 180 - direction;
        }

        return direction;
    }

    toHeading(direction: number): string {
        if (isNaN(direction)) {
            return '';
        }

        const rounded = this.standardize360(Math.round(direction));

        return `${rounded}°`;
    }

    toHeadingDirection(direction: number, precision = 2): string {
        if (isNaN(direction)) {
            return '';
        }

        const rounded = this.standardize360(Math.round(direction));

        return `${this.toHeading(rounded)} ${this.toCompassPoint(
            rounded,
            precision
        )}`;
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
