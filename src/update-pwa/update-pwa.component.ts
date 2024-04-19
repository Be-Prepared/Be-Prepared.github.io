import { Component, css, di, html } from 'fudgel';
import { UpdatePwaService } from './update-pwa.service';

@Component('update-pwa', {
    style: css`
        .load-svg-wrapper {
            padding: 0 3%;
            width: 5em;
            background-color: var(--bg-color);
        }

        .update-text {
            display: flex;
            justify-content: center;
            padding: 0 0.3em;
        }

        .space {
            min-width: 2em;
            flex-grow: 1;
        }

        .buttons {
            display: flex;
            justify-content: space-between;
        }

        .button {
            text-align: center;
        }

        .drawer {
            width: 100%;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
    `,
    template: html`
        <bottom-drawer #ref="drawer">
            <div class="drawer">
                <div class="update-text">
                    <i18n-label id="update.message"></i18n-label>
                </div>
                <div class="buttons">
                    <div class="button">
                        <styled-link @click.stop.prevent="reload()"
                            ><i18n-label id="update.reload"></i18n-label
                        ></styled-link>
                    </div>
                    <div class="space"></div>
                    <div class="button">
                        <styled-link @click.stop.prevent="skip()"
                            ><i18n-label id="update.skip"></i18n-label
                        ></styled-link>
                    </div>
                </div>
            </div>
        </bottom-drawer>
    `,
})
export class UpdatePwaComponent {
    #updatePwaService = di(UpdatePwaService);
    drawer?: HTMLElement;

    onViewInit() {
        if (this.drawer) {
            (this.drawer as any).show();
        }
    }

    reload() {
        this.#updatePwaService.performUpdate();
        this.#callDrawer('hide');
    }

    #callDrawer(action: 'show' | 'hide') {
        if (this.drawer) {
            (this.drawer as any)[action]();
        }
    }
}
