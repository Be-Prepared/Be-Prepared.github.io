import { AvailabilityState } from '../datatypes/availability-state';
import { Component, css, di, html } from 'fudgel';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TorchService } from '../services/torch.service';
import { WakeLockService } from '../services/wake-lock.service';

@Component('info-app', {
    style: css`
        :host {
            display: flex;
            flex-direction: column;
            font-size: 1.2em;
            height: 100%;
            box-sizing: border-box;
            padding: 1em;
        }

        .wrapper {
            border-width: 1px;
            padding: 0.3em;
            border-style: solid;
            box-sizing: border-box;
            height: 100%;
            overflow-x: auto;
        }
    `,
    template: html`
    <div class="wrapper">
        <p><i18n-label id="info.permissionsAndFeaturesHeader"></i18n-label></p>
        <ul>
            <li><i18n-label id="info.camera"></i18n-label> <info-app-permission permission="camera"></info-app-permission></li>
            <li><i18n-label id="info.torch"></i18n-label> <info-app-availability .availability-state="torch"></info-app-permission></li>
            <li><i18n-label id="info.wakeLock"></i18n-label> <info-app-availability .availability-state="wakeLock"></info-app-permission></li>
        </ul>

        <p><i18n-label id="info.toolingHeader"></i18n-label></p>
        <ul>
            <li><styled-link href="https://fudgel.js.org">Fudgel</styled-link> - <i18n-label id="info.framework"></i18n-label></li>
            <li><styled-link href="https://vecta.io/nano">Vecta.io</styled-link> - <i18n-label id="info.svgCompression"></i18n-label></li>
        </ul>

        <p><i18n-label id="info.buildInformationHeader"></i18n-label></p>
        <ul>
            <li>{{buildDate}} ({{version}})</li>
            <li>Node.js {{nodeVersion}} ({{hostPlatform}} {{hostArch}})</li>
        </ul>
    </div>
    <back-button></back-button>
    `,
})
export class InfoAppComponent {
    #subject = new Subject();
    #torchService = di(TorchService);
    #wakeLockService = di(WakeLockService);
    buildDate = __BUILD_DATE__;
    hostPlatform = __HOST_PLATFORM__;
    hostArch = __HOST_ARCH__;
    nodeVersion = __NODE_VERSION__;
    torch = AvailabilityState.ERROR;
    version = __BE_PREPARED_VERSION__;
    wakeLock = AvailabilityState.ERROR;

    constructor() {
        this.#torchService
            .availabilityState()
            .pipe(takeUntil(this.#subject))
            .subscribe((status) => {
                this.torch = status;
            });
        this.#wakeLockService
            .availabilityState()
            .pipe(takeUntil(this.#subject))
            .subscribe((status) => {
                this.wakeLock = status;
            });
    }

    onDestroy() {
        this.#subject.next(null);
        this.#subject.complete();
    }
}
