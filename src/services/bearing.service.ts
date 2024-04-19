export class BearingService {
    // Bearing is converted to [-180, 180).
    standardize180(bearing: number) {
        if (bearing >= -180 && bearing < 180) {
            return bearing;
        }

        if (bearing >= 0 && bearing < 360) {
            return bearing - 180;
        }

        return this.standardize360(bearing) - 180;
    }

    standardize360(bearing: number) {
        if (bearing >= 0 && bearing < 360) {
            return bearing;
        }

        return ((bearing % 360) + 360) % 360;
    }

    toCompassPoint(bearing: number, precision = 2) {
        // Thanks to https://github.com/chrisveness/geodesy/blob/master/dms.js
        precision = Math.max(1, Math.min(3, Math.floor(precision)));
        bearing = this.standardize360(bearing);
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
            cardinals[((Math.round((bearing * n) / 360) % n) * 16) / n];

        return cardinal;
    }
}
