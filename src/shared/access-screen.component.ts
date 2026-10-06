import { AccessState } from '../services/access/access-controller';
import { component, css, emit, html } from 'fudgel';
import { goBack } from '../util/go-back';

interface ScreenConfig {
    action: string | null;
    heading: string;
    hint: string | null;
    icon: string;
    message: string | null;
}

function platformHint() {
    const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;

    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document)) {
        return 'shared.access.deniedHint.ios';
    }

    if (/Android/.test(ua)) {
        return 'shared.access.deniedHint.android';
    }

    return 'shared.access.deniedHint.other';
}

// Explains what's going on when a tool can't run yet: permission needs to be
// asked for, was denied, the hardware is missing, or something failed. Emits
// "grant" when the person wants to (re)try.
export class AccessScreenComponent {
    // Explanation of why the permission is needed.
    messageId = '';
    // Message when the hardware is missing.
    unavailableId = '';
    // Message when starting failed for another reason.
    errorId = '';
    // Icon shown on the prompt screen.
    icon = '/lock.svg';
    state: AccessState = AccessState.CHECKING;
    config: ScreenConfig | null = null;

    onChange() {
        this.config = this._config();
    }

    back() {
        goBack();
    }

    grant() {
        emit(this, 'grant');
    }

    private _config(): ScreenConfig | null {
        switch (this.state) {
            case AccessState.PROMPT:
                return {
                    action: 'shared.access.allow',
                    heading: 'shared.access.prompt.heading',
                    hint: 'shared.access.prompt.hint',
                    icon: this.icon || '/lock.svg',
                    message: this.messageId || null,
                };

            case AccessState.DENIED:
                return {
                    action: 'shared.access.tryAgain',
                    heading: 'shared.access.denied.heading',
                    hint: platformHint(),
                    icon: '/lock.svg',
                    message: 'shared.access.denied.message',
                };

            case AccessState.UNAVAILABLE:
                return {
                    action: null,
                    heading: 'shared.access.unavailable.heading',
                    hint: null,
                    icon: '/warning.svg',
                    message:
                        this.unavailableId ||
                        'shared.access.unavailable.message',
                };

            case AccessState.ERROR:
                return {
                    action: 'shared.access.tryAgain',
                    heading: 'shared.access.error.heading',
                    hint: null,
                    icon: '/warning.svg',
                    message: this.errorId || 'shared.access.error.message',
                };

            default:
                return null;
        }
    }
}

component(
    'access-screen',
    {
        attr: ['messageId', 'unavailableId', 'errorId', 'icon', 'state'],
        style: css`
            :host {
                display: flex;
                position: absolute;
                inset: 0;
                padding: var(--space-4);
                box-sizing: border-box;
                overflow: auto;
            }

            .card {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: var(--space-3);
                max-width: 26rem;
                width: 100%;
                text-align: center;
                /* Centers when it fits, scrolls from the top when it doesn't
                   (short landscape screens). */
                margin: auto;
            }

            .checking {
                margin: auto;
            }

            @media (max-height: 480px) {
                .card {
                    gap: var(--space-2);
                }

                .icon {
                    width: 2.75rem;
                    height: 2.75rem;
                }

                .heading {
                    font-size: 1.25rem;
                }

                .actions {
                    flex-direction: row;
                }

                .actions pretty-button {
                    flex: 1;
                }
            }

            .icon {
                width: 4.5rem;
                height: 4.5rem;
                color: var(--accent);
            }

            .heading {
                font-size: 1.5rem;
                font-weight: 700;
                margin: 0;
            }

            .message {
                margin: 0;
                font-size: 1.05rem;
            }

            .hint {
                margin: 0;
                font-size: 0.9rem;
                color: var(--fg-muted);
                background: var(--surface);
                border: 1px solid var(--border);
                border-radius: var(--radius-m);
                padding: var(--space-3);
                text-align: start;
            }

            .actions {
                display: flex;
                flex-direction: column;
                gap: var(--space-2);
                width: 100%;
                margin-top: var(--space-2);
            }

            .checking {
                width: 2.5rem;
                height: 2.5rem;
                border-radius: 50%;
                border: 3px solid var(--border);
                border-top-color: var(--accent);
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                to {
                    transform: rotate(360deg);
                }
            }
        `,
        template: html`
            <div *if="!config" class="checking"></div>
            <div *if="config" class="card">
                <load-svg class="icon" href="{{config.icon}}"></load-svg>
                <h1 class="heading">
                    <i18n-label id="{{config.heading}}" ws=""></i18n-label>
                </h1>
                <p *if="config.message" class="message">
                    <i18n-label id="{{config.message}}" ws=""></i18n-label>
                </p>
                <p *if="config.hint" class="hint">
                    <i18n-label id="{{config.hint}}" ws=""></i18n-label>
                </p>
                <div class="actions">
                    <pretty-button
                        *if="config.action"
                        variant="primary"
                        @click.stop.prevent="grant()"
                        ><i18n-label id="{{config.action}}" ws=""></i18n-label
                    ></pretty-button>
                    <pretty-button @click.stop.prevent="back()"
                        ><i18n-label id="shared.access.back" ws=""></i18n-label
                    ></pretty-button>
                </div>
            </div>
        `,
    },
    AccessScreenComponent
);
