import { BrowserService } from '../services/browser.service';
import { component, css, html } from 'fudgel';
import { di } from '../di';

// Shown on the home screen only when the browser is very likely not the one
// this app works best with. Dismissing it is remembered.
export class BrowserNoticeComponent {
    private _browserService = di(BrowserService);
    bodyId = '';
    browserId = '';
    show = false;

    onInit() {
        const detection = this._browserService.detect();
        this.show = this._browserService.shouldShowNotice();
        this.bodyId = `browserNotice.body.${detection.platform}`;
        this.browserId = `browser.name.${detection.browser}`;
    }

    dismiss() {
        this._browserService.dismissNotice();
        this.show = false;
    }
}

component(
    'browser-notice',
    {
        style: css`
            :host {
                display: block;
            }

            .notice {
                display: flex;
                gap: var(--space-3);
                align-items: flex-start;
                padding: var(--space-3);
                margin-bottom: var(--space-4);
                border-radius: var(--radius-m);
                background: var(--warning-bg);
                border: 1px solid var(--warning);
                line-height: 1.4;
            }

            .icon {
                flex-shrink: 0;
                width: 1.5rem;
                height: 1.5rem;
                color: var(--warning);
            }

            .body {
                flex: 1 1 auto;
                min-width: 0;
            }

            .heading {
                font-weight: 700;
                margin-bottom: var(--space-1);
            }

            .detected {
                font-size: 0.85rem;
                color: var(--fg-muted);
                margin-top: var(--space-1);
            }

            .actions {
                margin-top: var(--space-3);
                display: flex;
                justify-content: flex-end;
            }
        `,
        template: html`
            <div *if="show" class="notice" role="note">
                <load-svg class="icon" href="/warning.svg"></load-svg>
                <div class="body">
                    <div class="heading">
                        <i18n-label id="browserNotice.heading" ws=""></i18n-label>
                    </div>
                    <i18n-label id="{{bodyId}}" ws=""></i18n-label>
                    <div class="detected">
                        <i18n-label id="browser.detected" ws=""></i18n-label>
                        <i18n-label id="{{browserId}}"></i18n-label>
                    </div>
                    <div class="actions">
                        <pretty-button @click.stop.prevent="dismiss()"
                            ><i18n-label
                                id="browserNotice.dismiss"
                                ws=""
                            ></i18n-label
                        ></pretty-button>
                    </div>
                </div>
            </div>
        `,
    },
    BrowserNoticeComponent
);
