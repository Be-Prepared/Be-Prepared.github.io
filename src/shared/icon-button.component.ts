import { component, css, html } from 'fudgel';
import { di } from '../di';
import { I18nService } from '../i18n/i18n.service';

// Round toolbar button with an icon. Used in the bottom/side bar of tools.
export class IconButtonComponent {
    private _i18nService = di(I18nService);
    active = false;
    buttonClass = '';
    disabled = false;
    pressed = 'false';
    href = '';
    label = '';
    labelId = '';

    onChange() {
        this.label = this.labelId ? this._i18nService.get(this.labelId) : '';
        this.buttonClass = this.active ? 'active' : '';
        this.pressed = this.active ? 'true' : 'false';
    }
}

component(
    'icon-button',
    {
        attr: ['href', 'labelId'],
        prop: ['active', 'disabled'],
        style: css`
            :host {
                display: block;
            }

            button {
                width: var(--tap);
                height: var(--tap);
                border-radius: 50%;
                border: 1px solid var(--border);
                background: var(--surface);
                color: var(--fg);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0;
                font-family: inherit;
                cursor: pointer;
                box-shadow: var(--shadow);
                transition: background-color 0.15s, color 0.15s,
                    transform 0.1s;
            }

            button:active {
                transform: scale(0.94);
            }

            button:focus-visible {
                outline: 3px solid var(--accent);
                outline-offset: 2px;
            }

            button.active {
                background: var(--accent);
                border-color: var(--accent);
                color: var(--accent-fg);
            }

            button:disabled {
                opacity: 0.4;
                cursor: default;
            }

            load-svg {
                width: 55%;
                height: 55%;
            }
        `,
        template: html`
            <button
                class="{{buttonClass}}"
                .disabled="disabled"
                aria-label="{{label}}"
                title="{{label}}"
                aria-pressed="{{pressed}}"
            >
                <load-svg href="{{href}}"></load-svg>
            </button>
        `,
        useShadow: true,
    },
    IconButtonComponent
);
