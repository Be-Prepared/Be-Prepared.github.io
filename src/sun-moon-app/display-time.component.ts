import { Component, css, html } from 'fudgel';
import { di } from '../di';
import { Subscription } from 'rxjs';
import { TimeService } from '../services/time.service';

@Component('display-time', {
    attr: ['id', 'failId'],
    prop: ['time'],
    style: css``,
    template: html`
        <div *if="time">
            <i18n-label id="{{id}}"></i18n-label>
            <changeable-setting @click.stop.prevent="toggle()">
                {{timeStr}}
            </changeable-setting>
        </div>
    `,
})
export class DisplayTimeComponent {
    private _subscription?: Subscription;
    private _timeService = di(TimeService);
    time?: Date;
    timeStr: string = '';

    onInit() {
        this._subscription = this._timeService.getCurrentSetting().subscribe(() => {
            this._redraw();
        });
    }

    onDestroy() {
        this._subscription && this._subscription.unsubscribe();
    }

    onChange(prop: string) {
        if (prop === 'time') {
            this._redraw();
        }
    }

    toggle() {
        this._timeService.toggleSystem();
        this._redraw();
    }

    _redraw() {
        if (
            this.time &&
            this.time instanceof Date &&
            !isNaN(this.time.getTime())
        ) {
            this.timeStr = this._timeService.formatTimeOfDay(
                this.time.getTime()
            );
        } else {
            this.timeStr = '';
        }
    }
}
