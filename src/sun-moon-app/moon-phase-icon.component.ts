import { component, css, html } from 'fudgel';
import { moonLitPath } from './moon-drawing';

// The moon as it looks: a dark disk with the lit part drawn on top.
export class MoonPhaseIconComponent {
    fraction = 0;
    litPath = '';
    right = true;

    onChange() {
        this.litPath = moonLitPath(this.fraction || 0, !!this.right, 50);
    }
}

component(
    'moon-phase-icon',
    {
        prop: ['fraction', 'right'],
        style: css`
            :host {
                display: inline-block;
                width: 3.5rem;
                height: 3.5rem;
                flex: none;
            }

            svg {
                display: block;
                width: 100%;
                height: 100%;
            }

            .dark {
                fill: var(--moon-dark);
            }

            .lit {
                fill: var(--moon-lit);
            }

            .rim {
                fill: none;
                stroke: var(--moon-rim);
                stroke-width: 2;
            }
        `,
        template: html`
            <svg viewBox="-2 -2 104 104" aria-hidden="true">
                <circle class="dark" cx="50" cy="50" r="50"></circle>
                <path class="lit" d="{{litPath}}"></path>
                <circle class="rim" cx="50" cy="50" r="50"></circle>
            </svg>
        `,
    },
    MoonPhaseIconComponent
);
