import { Component, css, di, html } from 'fudgel';
import { WakeLockService } from '../services/wake-lock.service';

@Component('front-light-app', {
    style: css`
        .bright {
            background-color: white;
            color: black;
        }
    `,
    template: html`
        <default-layout class="bright"></default-layout>
    `,
})
export class FrontLightAppComponent {
    private _wakeLockService = di(WakeLockService);

    onInit() {
        this._wakeLockService.request();
    }

    onDestroy() {
        this._wakeLockService.release();
    }
}
