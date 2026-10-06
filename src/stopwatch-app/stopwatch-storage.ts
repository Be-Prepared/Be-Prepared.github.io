import { LocalStorageService } from '../services/local-storage.service';
import { isStopwatchState, StopwatchState } from './stopwatch-math';

// Saved so the stopwatch keeps counting after leaving the screen or closing
// the app. It's wall-clock based, so nothing needs to run in the meantime.
export const stopwatchStorage = LocalStorageService.json<StopwatchState>(
    'stopwatch.state',
    1,
    isStopwatchState
);
