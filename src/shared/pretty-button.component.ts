import { component, css, html } from 'fudgel';

// variant: "primary" (filled accent), or omitted for a neutral button.
// enabled: highlights the button as switched on.
export class PrettyButtonComponent {
    button?: HTMLButtonElement;
    buttonClass = '';
    enabled = false;
    padding = '';
    variant = '';

    onChange() {
        this.buttonClass = [this.variant, this.enabled ? 'enabled' : '']
            .filter(Boolean)
            .join(' ');
    }

    onViewInit() {
        if (this.button && this.padding) {
            this.button.style.padding = this.padding;
        }
    }
}

component(
    'pretty-button',
    {
        attr: ['padding', 'variant'],
        prop: ['enabled'],
        style: css`
            :host {
                display: block;
            }

            button {
                width: 100%;
                min-height: var(--tap);
                padding: var(--space-2) var(--space-5);
                background-color: var(--surface-2);
                border: 1px solid var(--border);
                border-radius: var(--radius-m);
                color: inherit;
                font-size: inherit;
                font-family: inherit;
                font-weight: 600;
                cursor: pointer;
                user-select: none;
                transition: background-color 0.15s, transform 0.1s;
            }

            button:active {
                transform: scale(0.98);
            }

            button:focus-visible {
                outline: 3px solid var(--accent);
                outline-offset: 2px;
            }

            .primary {
                background-color: var(--accent);
                border-color: var(--accent);
                color: var(--accent-fg);
            }

            .enabled {
                background-color: var(--accent-soft);
                border-color: var(--accent);
            }
        `,
        template: html`
            <button
                class="{{buttonClass}}"
                #ref="button"
            >
                <slot></slot>
            </button>
        `,
        useShadow: true,
    },
    PrettyButtonComponent
);
