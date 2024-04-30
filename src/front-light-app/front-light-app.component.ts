import { Component, css, di, html } from 'fudgel';
import { goBack } from '../util/go-back';
import { WakeLockService } from '../services/wake-lock.service';

@Component('front-light-app', {
    style: css`
        .full {
            width: 100%;
            height: 100%;
            background-color: white;
            color: black;
        }

        .back {
            position: fixed;
            bottom: 0;
            left: 0;
        }
    `,
    template: html`
        <div class="full">
            <div class="back">
                <back-button></back-button>
            </div>
        </div>
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

    back() {
        goBack();
    }
}
