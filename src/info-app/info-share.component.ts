import { Component, css, html } from 'fudgel';

@Component('info-share', {
    style: css`
        .wrapper {
            position: relative;
        }

        load-svg {
            max-width: 25vw;
            margin: 0 auto;
        }

        .copied {
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            position: absolute;
            opacity: 0;
            transition: opacity 1s;
        }

        .copied.visible {
            opacity: 1;
        }

        .copied div {
            border: 3px solid var(--fg-color);
            background-color: var(--bg-color);
            padding: 1em;
            border-radius: 1em;
            text-align: center;
        }

        @media (max-width: 960px) {
            load-svg {
                max-width: 50vw;
            }
        }

        @media (max-width: 480px) {
            load-svg {
                max-width: 100vw;
            }
        }
    `,
    template: html`
        <div class="wrapper" @click.stop.prevent="clicked()">
        <load-svg href="qr-code.svg"></load-svg>
        <div class="copied" #ref="copied"><div><i18n-label id="info.shareCopied"></i18n-label></div></div>
        </div>
    `,
})
export class InfoShareComponent {
    copied?: HTMLDivElement;
    timeout?: ReturnType<typeof setTimeout>;

    clicked() {
        if (navigator.clipboard) {
            navigator.clipboard.writeText('https://be-prepared.github.io/');

            if (this.copied) {
                this.copied.classList.add('visible');

                if (this.timeout) {
                    clearTimeout(this.timeout);
                }

                this.timeout = setTimeout(() => {
                    if (this.copied) {
                        this.copied.classList.remove('visible');
                    }
                }, 3000);
            }
        }
    }
}
