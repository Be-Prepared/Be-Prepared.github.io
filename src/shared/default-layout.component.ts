import { component, css, html } from 'fudgel';

// Standard screen for a tool: content area plus a toolbar with the back
// button. The toolbar sits at the bottom in portrait and on the right in
// landscape, where thumbs are.
//
// frame: show the content on a card.
// overlay: transparent, for drawing on top of a camera view.
export class DefaultLayoutComponent {
    frame?: string;
    hostClasses = '';
    overlay?: string;

    onChange() {
        const classes = [];

        if (this.frame || this.frame === '') {
            classes.push('frame');
        }

        if (this.overlay || this.overlay === '') {
            classes.push('overlay');
        }

        this.hostClasses = classes.join(' ');
    }
}

component(
    'default-layout',
    {
        attr: ['frame', 'overlay'],
        style: css`
            :host {
                display: block;
                position: absolute;
                inset: 0;
            }

            /* Keep the toolbar above a camera view, which browsers may draw
               on its own layer. */
            :host([overlay]) {
                z-index: 1;
            }

            .layout {
                display: flex;
                flex-direction: column;
                height: 100%;
                width: 100%;
                box-sizing: border-box;
                padding: env(safe-area-inset-top) env(safe-area-inset-right)
                    env(safe-area-inset-bottom) env(safe-area-inset-left);
            }

            .outer {
                flex: 1 1 auto;
                min-height: 0;
                min-width: 0;
                padding: var(--space-4) var(--space-4) 0 var(--space-4);
                display: flex;
                box-sizing: border-box;
            }

            .inner {
                flex-grow: 1;
                overflow: auto;
                height: 100%;
                width: 100%;
                box-sizing: border-box;
            }

            .frame .inner {
                padding: var(--space-4);
                background: var(--surface);
                border: 1px solid var(--border);
                border-radius: var(--radius-l);
                box-shadow: var(--shadow);
            }

            .buttons {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: var(--space-3);
                padding: var(--space-3) var(--space-4);
            }

            .more {
                display: flex;
                gap: var(--space-3);
                align-items: center;
            }

            .overlay .buttons {
                background: linear-gradient(transparent, var(--overlay-bg));
            }

            @media (orientation: landscape) {
                .layout {
                    /* Typically, people rotate their phone CCW */
                    flex-direction: row;
                }

                .buttons {
                    flex-direction: column-reverse;
                    padding: var(--space-4) var(--space-3);
                }

                .more {
                    flex-direction: column-reverse;
                }

                .outer {
                    padding: var(--space-4) 0 var(--space-4) var(--space-4);
                }

                .overlay .buttons {
                    background: linear-gradient(
                        to right,
                        transparent,
                        var(--overlay-bg)
                    );
                }
            }
        `,
        template: html`
            <div class="layout {{hostClasses}}">
                <div class="outer">
                    <div class="inner">
                        <slot></slot>
                    </div>
                </div>
                <div class="buttons">
                    <back-button></back-button>
                    <div class="more">
                        <slot name="more-buttons"></slot>
                    </div>
                </div>
            </div>
        `,
        useShadow: true,
    },
    DefaultLayoutComponent
);
