import { Component, css, html } from 'fudgel';
import { di } from '../di';
import { EverySecondService } from '../services/every-second.service';
import { TimeService } from '../services/time.service';

@Component('location-field-time', {
    style: css``,
    template: html` <changeable-setting @click="toggleTimeSystem()"
        >{{value}}</changeable-setting
    >`,
})
export class LocationFieldTimeComponent {
    private _cancelEverySecond: () => void;
    private _everySecondService = di(EverySecondService);
    private _timeService = di(TimeService);
    value?: string;

    constructor() {
        this._cancelEverySecond = this._everySecondService.callEverySecond(
            () => {
                this.value = this._timeService.formatTimeOfDay(Date.now());
            }
        );
    }

    onDestroy() {
        this._cancelEverySecond();
    }

    toggleTimeSystem() {
        this._timeService.toggleSystem();
    }
}
