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

    // The toolbar lays its buttons out from the far end (see the styles),
    // so they are numbered backwards to keep reading in the order written.
    order(slot: HTMLSlotElement) {
        slot.assignedElements().forEach((element, index) => {
            (element as HTMLElement).style.order = `${-index}`;
        });
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

            /* Back sits in the corner. The other buttons line up beside
               it, and when there are too many for one line the first ones
               move to a second line, further from the thumb:

                         V  W
                   <  X  Y  Z

               To fill the line next to Back first, the buttons are laid
               out from the far end in reverse (see order() for the other
               half of this), which still reads V W X Y Z. */
            .buttons {
                display: flex;
                align-items: flex-end;
                gap: var(--space-3);
                padding: var(--space-3) var(--space-4);
            }

            .more {
                flex: 1 1 0;
                min-width: 0;
                display: flex;
                flex-direction: row-reverse;
                flex-wrap: wrap-reverse;
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

                /* Sideways, the toolbar runs up the edge with Back at the
                   bottom, and a second line becomes a second column further
                   from the edge. */
                .buttons {
                    flex-direction: column-reverse;
                    align-items: flex-end;
                    padding: var(--space-4) var(--space-3);
                }

                /* Vertical writing mode makes "lines" run top to bottom
                   and stack from the edge of the screen inward, so the
                   same wrapping works and the toolbar is only as wide as
                   the columns it really has. (A wrapping flex column or a
                   grid reserves room for columns it doesn't use.) */
                .more {
                    writing-mode: vertical-rl;
                    flex-direction: row;
                    flex-wrap: wrap;
                    min-width: auto;
                    min-height: 0;
                }

                ::slotted(*) {
                    writing-mode: horizontal-tb;
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
                        <slot
                            name="more-buttons"
                            @slotchange="order($event.target)"
                        ></slot>
                    </div>
                </div>
            </div>
        `,
        useShadow: true,
    },
    DefaultLayoutComponent
);
