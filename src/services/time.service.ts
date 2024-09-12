import { BehaviorSubject } from 'rxjs';
import { di } from '../di';
import { I18nService } from '../i18n/i18n.service';
import { PreferenceService } from './preference.service';
import { TimeSystem } from '../datatypes/time-system';

export const TIME_SYSTEMS = [TimeSystem['12_HOUR'], TimeSystem['24_HOUR']];

export const TimeSystemDefault = TimeSystem['24_HOUR'];

export class TimeService {
    private _currentSetting = new BehaviorSubject<TimeSystem>(
        TimeSystemDefault
    );
    private _i18nService = di(I18nService);
    private _preferenceService = di(PreferenceService);

    formatTime(time: number) {
        const seconds = Math.floor(time / 1000) % 60;
        const minutes = Math.floor(seconds / 60000) % 60;
        const hours = Math.floor(minutes / 3600000) % 24;

        return `${hours}:${this._pad(minutes)}:${this._pad(seconds)}`;
    }

    formatTimeOfDay(time: number) {
        const t = new Date(time);

        if (this._currentSetting.value === TimeSystem['12_HOUR']) {
            const hours = t.getHours();
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const ampmLabel = this._i18nService.get(`info.time12Hour.${ampm}`);
            const hours12 = hours % 12 || 12;

            return `${hours12}:${this._pad(t.getMinutes())}:${this._pad(
                t.getSeconds()
            )} ${ampmLabel}`;
        }

        return `${this._pad(t.getHours())}:${this._pad(
            t.getMinutes()
        )}:${this._pad(t.getSeconds())}`;
    }

    getCurrentSetting() {
        return this._currentSetting.asObservable();
    }

    setTimeSystem(value: TimeSystem) {
        if (TIME_SYSTEMS.includes(value)) {
            this._currentSetting.next(value);
            this._preferenceService.timeSystem.setItem(value);
        }
    }

    toggleSystem() {
        const newValue =
            this._currentSetting.value === TimeSystem['24_HOUR']
                ? TimeSystem['12_HOUR']
                : TimeSystem['24_HOUR'];
        this.setTimeSystem(newValue);
    }

    private _pad(value: number) {
        return `0${value}`.slice(-2);
    }
}
