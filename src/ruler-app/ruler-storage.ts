import { LocalStorageService } from '../services/local-storage.service';

export interface RulerCalibration {
    // CSS pixels per millimeter when calibrated.
    pxPerMm: number;
    // devicePixelRatio at that time, so browser zoom can be accounted for.
    ratio: number;
}

export const calibrationStorage = LocalStorageService.json<RulerCalibration>(
    'ruler.calibration',
    1,
    (value) =>
        !!value &&
        typeof value.pxPerMm === 'number' &&
        isFinite(value.pxPerMm) &&
        typeof value.ratio === 'number' &&
        isFinite(value.ratio)
);
