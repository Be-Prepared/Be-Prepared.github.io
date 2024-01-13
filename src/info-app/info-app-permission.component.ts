import { Attr, Component, css, di, html } from 'fudgel';
import {
    PermissionsService,
    PermissionsServiceName,
    PermissionsServiceState,
} from '../services/permissions.service';
import { Subscription } from 'rxjs';

@Component('info-app-permission', {
    style: css`
        .state_granted {
            color: green;
        }

        .state_granted::before {
            content: "✔ ";
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

        .state_denied::before {
            content: "✖ "
        }

        .state_unavailable {
            color: gray;
        }
    `,
    template: html`
        {{this.name}}: <span class="state_{{this.stateStr}}">{{this.stateStr}}</span>
    `,
})
export class InfoAppPermission {
    #permissionsService = di(PermissionsService);
    #subscription?: Subscription;
    @Attr() name?: string;
    @Attr() permission?: PermissionsServiceName;
    stateStr = 'error';

    onChange(property: string) {
        if (property !== 'permission') {
            return;
        }

        this.#unsub();

        if (this.permission && this.#permissionsService[this.permission]) {
            this.#subscription = this.#permissionsService
                [this.permission]()
                .subscribe((state) => this.#setState(state));
        } else {
            this.#setState(PermissionsServiceState.ERROR);
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
        } else if (state === PermissionsServiceState.UNAVAILABLE) {
            this.stateStr = 'unavailable';;
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