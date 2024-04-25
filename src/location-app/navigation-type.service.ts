import { BehaviorSubject } from 'rxjs';

const allowedOptions = ['COMPASS', 'DIRECTION_OF_TRAVEL', 'NORTH_UP'];

export class NavigationTypeService {
    #subject = new BehaviorSubject<string>(allowedOptions[0]);

    constructor() {
        const savedValue = localStorage.getItem('navigationType') || '';

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
