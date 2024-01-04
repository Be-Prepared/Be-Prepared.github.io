import { Component, css, di, html, metadataControllerElement } from 'fudgel';
import { InstallPwaService } from './install-pwa.service';

@Component('install-pwa', {
    style: css`
        :host {
            width: 100%;
            top: 200vh;
            position: fixed;
            display: flex;
            justify-content: center;
            transition: bottom 1s ease-in-out 0s;
        }

        .tab {
            border-top-left-radius: 8px;
            border-top-right-radius: 8px;
            border-top: 2px solid;
            border-left: 2px solid;
            border-right: 2px solid;
            padding: 0.3em 0.6em;
            background-color: var(--button-bg-color);
            display: flex;
            align-items: center;
        }

        .load-svg-wrapper {
            padding: 0 3%;
            width: 5em;
            background-color: var(--bg-color);
        }

        .install-text {
            padding: 0 0.3em;
        }

        .space {
            flex-grow: 1;
        }

        @media (max-width: 60em) {
            .load-svg-wrapper {
                width: 4em;
            }
        }

        @media (max-width: 30em) {
            .load-svg-wrapper {
                width: 16%;
            }
        }

        @media (max-width: 20em) {
            .load-svg-wrapper {
                width: 25%;
            }
        }

        @media (max-width: 10em) {
            .load-svg-wrapper {
                width: 50%;
            }
        }
    `,
    template: html`
        <div class="tab">
            <div class="load-svg-wrapper">
               <load-svg href="toolbox.svg" @loadsvg.stop.prevent="this.logoLoaded()"></load-svg>
            </div>
            <div class="install-text">
                Install to Home Screen
            </div>
            <div class="space"></div>
            <div class="install-button"><styled-link @click.stop.prevent="this.install()">Install</styled-link></div>
        </div>
    `
})
export class InstallPwaComponent {
    #installPwaService = di(InstallPwaService);
    #timeout?: ReturnType<typeof setTimeout>;

    onDestroy() {
        if (this.#timeout) {
            clearTimeout(this.#timeout);
        }
    }

    logoLoaded() {
        const style = this.#element().style;
        style.top = 'auto';
        style.bottom = `-${this.#height()}px`;
        this.#timeout = setTimeout(() => this.#show(), 400);
    }

    install() {
        console.log('install');
    }

    #destroy() {
        this.#installPwaService.triggerSavedEvent();
    }

    #element() {
        return metadataControllerElement.get(this)!;
    }

    #height() {
        // Round any partials up and then add a 1 pixel buffer to ensure no
        // artifacts are visible by accident.
        const rect = this.#element().getBoundingClientRect();

        return Math.ceil(rect.height + 1);
    }

    #hide() {
        this.#element().style.bottom = `-${this.#height()}px`;
        this.#timeout = setTimeout(() => this.#destroy(), 2000);
    }

    #show() {
        this.#element().style.bottom = '0';
        this.#timeout = setTimeout(() => this.#hide(), 30000);
    }
}
