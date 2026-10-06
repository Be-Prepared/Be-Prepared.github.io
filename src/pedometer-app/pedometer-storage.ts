import { LocalStorageService } from '../services/local-storage.service';

// Stride length in meters, used for the step estimate.
export const strideStorage = LocalStorageService.number('pedometer.stride');
