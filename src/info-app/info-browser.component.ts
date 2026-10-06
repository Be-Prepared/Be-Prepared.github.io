import { BrowserService } from '../services/browser.service';
import { component, css, html } from 'fudgel';
import { di } from '../di';

// What browser and platform the app thinks it's in, as plain information.
export class InfoBrowserComponent {
    private _browserService = di(BrowserService);
    browserId = '';
    platformId = '';
    recommendedId = '';
    statusId = '';

    onInit() {
        const detection = this._browserService.detect();
        this.browserId = `browser.name.${detection.browser}`;
        this.platformId = `browser.platform.${detection.platform}`;
        this.recommendedId = `browser.recommended.${detection.platform}`;
        this.statusId = `browser.status.${detection.status}`;
    }
}

component(
    'info-browser',
    {
        style: css`
            .rows {
                display: grid;
                grid-template-columns: auto 1fr;
                gap: var(--space-1) var(--space-3);
            }

            .muted {
                color: var(--fg-muted);
                margin-top: var(--space-2);
            }
        `,
        template: html`
            <info-header id="browser.header"></info-header>
            <div class="rows">
                <i18n-label id="browser.platform" ws=""></i18n-label>
                <i18n-label id="{{platformId}}" ws=""></i18n-label>
                <i18n-label id="browser.browser" ws=""></i18n-label>
                <i18n-label id="{{browserId}}" ws=""></i18n-label>
                <i18n-label id="browser.recommended" ws=""></i18n-label>
                <i18n-label id="{{recommendedId}}" ws=""></i18n-label>
            </div>
            <div class="muted">
                <i18n-label id="{{statusId}}" ws=""></i18n-label>
            </div>
        `,
    },
    InfoBrowserComponent
);
