import { Component, css, html } from 'fudgel';

@Component('default-layout', {
    attr: ['frame'],
    style: css`
        :host {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
            box-sizing: border-box;
            position: absolute;
            inset: 0;
        }

        .outer {
            padding: 1em;
            height: 100%;
            width: 100%;
            overflow: hidden;
            display: flex;
            box-sizing: border-box;
        }

        .inner {
            flex-grow: 1;
            overflow: auto;
            height: 100%;
            width: 100%;
        }

        .frame {
            padding: 0.3em;
            box-sizing: border-box;
            border-style: solid;
            border-width: 1px;
        }

        .buttons {
            display: flex;
            justify-content: space-between;
        }

        @media (orientation: landscape) {
            :host {
                /* Typically, people rotate their phone CCW */
                flex-direction: row;
            }

            .buttons {
                flex-direction: column-reverse;
            }
        }
    `,
    template: html`
        <div class="outer">
            <div class="{{innerClasses}}">
                <slot></slot>
            </div>
        </div>
        <div class="buttons">
            <back-button></back-button>
            <slot name="more-buttons"></slot>
        </div>
    `,
    useShadow: true
})
export class DefaultLayoutComponent {
    frame?: string;
    innerClasses = 'inner';

    onChange() {
        const innerClasses = ['inner']

        if (this.frame || this.frame === '') {
            innerClasses.push('frame');
        }

        this.innerClasses = innerClasses.join(' ');
    }
}
