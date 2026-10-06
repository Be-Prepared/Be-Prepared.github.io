import { isValidOffsets, LEVEL_MODES, LevelOffsets } from './level-math';
import { LocalStorageService } from '../services/local-storage.service';

// Last mode used, so the level opens the way it was left.
export const levelModeStorage = LocalStorageService.list(
    'level.mode',
    LEVEL_MODES
);

// Per-mode zero points, for phones whose case or camera bump tilts them.
export const levelOffsetsStorage = LocalStorageService.json<LevelOffsets>(
    'level.offsets',
    1,
    isValidOffsets
);
