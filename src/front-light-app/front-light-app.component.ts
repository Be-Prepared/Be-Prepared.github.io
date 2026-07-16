import { component, css, html } from 'fudgel';
import { di } from '../di';
import { WakeLockService } from '../services/wake-lock.service';

export class FrontLightAppComponent {
    private _wakeLockService = di(WakeLockService);

    onInit() {
        this._wakeLockService.request();
    }

    onDestroy() {
        this._wakeLockService.release();
    }
}

component('front-light-app', {
    style: css`
        .bright {
            background-color: white;
            color: black;
        }
    `,
    template: html` <default-layout class="bright"></default-layout> `,
}, FrontLightAppComponent);
