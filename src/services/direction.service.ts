export class DirectionService {
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
