import { BehaviorSubject } from 'rxjs';

export enum NavigationType {
    COMPASS = 'COMPASS',
    DIRECTION_OF_TRAVEL = 'DIRECTION_OF_TRAVEL',
    NORTH_UP = 'NORTH_UP',
}
const allowedOptions = [
    NavigationType.COMPASS,
    NavigationType.DIRECTION_OF_TRAVEL,
    NavigationType.NORTH_UP,
];

export class NavigationTypeService {
    private _subject = new BehaviorSubject<NavigationType>(allowedOptions[0]);

    constructor() {
        const savedValue = localStorage.getItem(
            'navigationType',
        ) as NavigationType;

        if (allowedOptions.includes(savedValue)) {
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
        localStorage.setItem('navigationType', value);
    }
}
