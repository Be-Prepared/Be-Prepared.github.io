// A one-dimensional Kalman filter: a running estimate that trusts each new
// measurement according to how uncertain it is compared with the estimate.
//
// This used to come from a small library, but its default export didn't
// survive the production build ("default is not a constructor"), which
// silently broke everything that used it.

export class KalmanFilter {
    private _error: number;
    private _estimate: number;

    constructor(options: { initialEstimate: number; initialErrorInEstimate: number }) {
        this._estimate = options.initialEstimate;
        this._error = options.initialErrorInEstimate;
    }

    // Returns the new estimate and its error.
    update(options: { measurement: number; errorInMeasurement: number }): [number, number] {
        const gain = this._error / (this._error + options.errorInMeasurement);
        this._estimate += gain * (options.measurement - this._estimate);
        this._error *= 1 - gain;

        return [this._estimate, this._error];
    }
}

// The same filter over several values that share one error, such as
// longitude and latitude.
export class KalmanFilterArray {
    private _filters: KalmanFilter[];

    constructor(options: { initialEstimate: number[]; initialErrorInEstimate: number }) {
        this._filters = options.initialEstimate.map(
            (initialEstimate) =>
                new KalmanFilter({
                    initialEstimate,
                    initialErrorInEstimate: options.initialErrorInEstimate,
                })
        );
    }

    update(options: { measurement: number[]; errorInMeasurement: number }): [number[], number] {
        let error = 0;
        const estimates = this._filters.map((filter, i) => {
            const result = filter.update({
                measurement: options.measurement[i],
                errorInMeasurement: options.errorInMeasurement,
            });
            error = result[1];

            return result[0];
        });

        return [estimates, error];
    }
}
