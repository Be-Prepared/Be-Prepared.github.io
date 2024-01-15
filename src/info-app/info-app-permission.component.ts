import { Component, css, di, html } from 'fudgel';
import {
    PermissionsService,
    PermissionsServiceName,
    PermissionsServiceState,
} from '../services/permissions.service';
import { Subscription } from 'rxjs';

@Component('info-app-permission', {
    attr: ['permission'],
    style: css`
        .state_granted {
            color: green;
        }

        .state_error {
            color: purple;
        }

        .state_prompt {
            color: gray;
        }

        .state_denied {
            color: orange;
        }
    `,
    template: html`
        <span class="state_{{this.stateStr}}"
            ><i18n-label id="info.permission.{{this.stateStr}}"></i18n-label
        ></span>
    `,
})
export class InfoAppPermissionComponent {
    #permissionsService = di(PermissionsService);
    #subscription?: Subscription;
    permission?: PermissionsServiceName;
    stateStr = 'error';

    onChange(property: string) {
        if (property === 'permission') {
            this.#unsub();

            if (this.permission && this.#permissionsService[this.permission]) {
                this.#subscription = this.#permissionsService
                    [this.permission]()
                    .subscribe((state) => this.#setState(state));
            } else {
                this.#setState(PermissionsServiceState.ERROR);
            }
        }
    }

    onDestroy() {
        this.#unsub();
    }

    #setState(state: PermissionsServiceState) {
        if (state === PermissionsServiceState.DENIED) {
            this.stateStr = 'denied';
        } else if (state === PermissionsServiceState.GRANTED) {
            this.stateStr = 'granted';
        } else if (state === PermissionsServiceState.PROMPT) {
            this.stateStr = 'prompt';
        } else {
            this.stateStr = 'error';
        }
    }

    #unsub() {
        if (this.#subscription) {
            this.#subscription.unsubscribe();
            this.#subscription = undefined;
        }
    }
}
