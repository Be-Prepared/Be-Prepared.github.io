import { Component, css, html } from 'fudgel';

@Component('display-time', {
    attr: ['id', 'failId'],
    prop: ['time'],
    style: css`
    `,
    template: html`
        <div *if="time">
            <i18n-label id="{{id}}"></i18n-label>
            {{timeStr}}
        </div>
    `,
})
export class DisplayTimeComponent {
    time?: Date;
    timeStr: string = '';

    onChange(prop: string) {
        if (prop === 'time') {
            if (this.time && this.time instanceof Date && !isNaN(this.time.getTime())) {
                this.timeStr = this.time.toLocaleTimeString();
            } else {
                this.timeStr = '';
            }
        }
    }
}
