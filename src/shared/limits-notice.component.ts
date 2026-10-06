import { component, css, html } from 'fudgel';

// Plain statement of what a web app can't do for timers and alarms. Shown
// wherever someone might rely on the app to make a sound later, so nobody
// is surprised by an alarm that never rang.
//
// detail: an i18n id for the body. Ids ending in ".html" may contain a list.
// heading: optional i18n id for a bold first line.
// dim: quieter styling for Nightstand mode.
export class LimitsNoticeComponent {
    detail = '';
    dim?: string;
    heading = '';
    isHtml = false;
    wrapperClass = 'notice';

    onChange() {
        this.isHtml = this.detail.endsWith('.html');
        this.wrapperClass =
            this.dim || this.dim === '' ? 'notice dim' : 'notice';
    }
}

component(
    'limits-notice',
    {
        attr: ['detail', 'heading', 'dim'],
        style: css`
            :host {
                display: block;
            }

            .notice {
                display: flex;
                gap: var(--space-3);
                align-items: flex-start;
                padding: var(--space-3);
                border-radius: var(--radius-m);
                background: var(--warning-bg);
                border: 1px solid var(--warning);
                font-size: 0.9rem;
                text-align: start;
                line-height: 1.4;
            }

            .icon {
                flex-shrink: 0;
                width: 1.5rem;
                height: 1.5rem;
                color: var(--warning);
            }

            .heading {
                font-weight: 700;
                margin-bottom: var(--space-1);
            }

            /* Nightstand mode: readable but not bright. */
            .notice.dim {
                background: transparent;
                border-color: #3a2a1a;
                color: #6b4a2e;
            }

            .notice.dim .icon {
                color: #6b4a2e;
            }
        `,
        template: html`
            <div class="{{wrapperClass}}" role="note">
                <load-svg class="icon" href="/warning.svg"></load-svg>
                <div class="body">
                    <div *if="heading" class="heading">
                        <i18n-label id="{{heading}}" ws=""></i18n-label>
                    </div>
                    <i18n-html *if="isHtml" id="{{detail}}"></i18n-html>
                    <i18n-label
                        *if="!isHtml"
                        id="{{detail}}"
                        ws=""
                    ></i18n-label>
                </div>
            </div>
        `,
    },
    LimitsNoticeComponent
);
