import { BehaviorSubject } from 'rxjs';

export enum NavigationType {
    COMPASS = 'COMPASS',
    DIRECTION_OF_TRAVEL = 'DIRECTION_OF_TRAVEL',
    NORTH_UP = 'NORTH_UP',
};
const allowedOptions = [NavigationType.COMPASS, NavigationType.DIRECTION_OF_TRAVEL, NavigationType.NORTH_UP];

export class NavigationTypeService {
    #subject = new BehaviorSubject<NavigationType>(allowedOptions[0]);

    constructor() {
        const savedValue = localStorage.getItem('navigationType') as NavigationType;

        if (allowedOptions.includes(savedValue)) {
            this.#subject.next(savedValue);
        }
    }

    getObservable() {
        return this.#subject.asObservable();
    }

    toggleSetting() {
        const index = (allowedOptions.indexOf(this.#subject.value) + 1) % allowedOptions.length;
        const value = allowedOptions[index];
        this.#subject.next(value);
        localStorage.setItem('navigationType', value);
    }
}
