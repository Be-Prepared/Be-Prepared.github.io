import { BehaviorSubject } from 'rxjs';
import { NavigationType } from '../datatypes/navigation-type';
import { PreferenceService } from '../services/preference.service';

const allowedOptions = [
    NavigationType.COMPASS,
    NavigationType.DIRECTION_OF_TRAVEL,
    NavigationType.NORTH_UP,
];

export class NavigationTypeService {
    private _preferenceService = new PreferenceService();
    private _subject = new BehaviorSubject<NavigationType>(allowedOptions[0]);

    constructor() {
        const savedValue = this._preferenceService.navigationType.getItem();

        if (savedValue) {
            this._subject.next(savedValue);
        }
    }

    getObservable() {
        return this._subject.asObservable();
    }

    toggleSetting() {
        const index =
            (allowedOptions.indexOf(this._subject.value) + 1) %
            allowedOptions.length;
        const value = allowedOptions[index];
        this._subject.next(value);
        this._preferenceService.navigationType.setItem(value);
    }
}
