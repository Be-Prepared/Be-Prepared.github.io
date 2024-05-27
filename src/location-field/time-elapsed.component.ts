import { Component, css, di, html } from 'fudgel';
import { EverySecondService } from '../services/every-second.service';
import { TimeService } from '../services/time.service';

@Component('location-field-time-elapsed', {
    attr: ['startTime'],
    style: css``,
    template: html`{{value}}`,
})
export class LocationFieldTimeElapsedComponent {
    private _cancelEverySecond?: () => void;
    private _everySecondService = di(EverySecondService);
    private _timeService = di(TimeService);
    startTime?: string;
    value?: string;

    onInit() {
        const startTime = parseInt(this.startTime || '', 10);
        this._cancelEverySecond = this._everySecondService.callEverySecond(() => {
            this.value = this._timeService.formatTime(Date.now() - startTime);
        });
    }

    onDestroy() {
        this._cancelEverySecond && this._cancelEverySecond();
    }

    toggleTimeSystem() {
        this._timeService.toggleSystem();
    }
}
