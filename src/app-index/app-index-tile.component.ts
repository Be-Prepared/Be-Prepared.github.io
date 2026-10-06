import { component, css, html } from 'fudgel';

export class AppIndexTileComponent {
    icon?: string;
    id?: string;
    label?: string;

    onInit() {
        history.replaceState({}, document.title, '/');
    }

    setActiveTool() {
        history.pushState({}, document.title, `/${this.id}`);
    }
}

component(
    'app-index-tile',
    {
        attr: ['icon', 'id', 'label'],
        style: css`
            :host {
                display: block;
            }

            button {
                width: 100%;
                aspect-ratio: 1 / 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: var(--space-2);
                padding: var(--space-3) var(--space-2);
                box-sizing: border-box;
                background: var(--surface);
                color: var(--fg);
                border: 1px solid var(--border);
                border-radius: var(--radius-l);
                box-shadow: var(--shadow);
                font: inherit;
                cursor: pointer;
                transition: transform 0.1s, border-color 0.15s;
            }

            button:active {
                transform: scale(0.96);
                border-color: var(--accent);
            }

            button:focus-visible {
                outline: 3px solid var(--accent);
                outline-offset: 2px;
            }

            .icon {
                width: 46%;
                max-width: 4.5rem;
                aspect-ratio: 1 / 1;
                color: var(--accent);
            }

            .label {
                font-size: 0.9rem;
                font-weight: 600;
                line-height: 1.2;
                text-align: center;
            }
        `,
        template: html`
            <button @click.stop.prevent="setActiveTool()">
                <load-svg class="icon" href="{{icon}}"></load-svg>
                <span class="label">
                    <i18n-label id="{{label}}" ws=""></i18n-label>
                </span>
            </button>
        `,
        useShadow: true,
    },
    AppIndexTileComponent
);
