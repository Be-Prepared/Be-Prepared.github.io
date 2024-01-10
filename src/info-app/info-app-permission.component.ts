import { Attr, Component, css, di, html } from 'fudgel';
import {
    PermissionsService,
    PermissionsServiceName,
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
    `,
    template: html`
        {{this.name}}: <span class="state_{{this.state}}">{{this.state}}</span>
    `,
})
export class InfoAppPermission {
    #permissionsService = di(PermissionsService);
    #subscription?: Subscription;
    @Attr() name?: string;
    @Attr() permission?: PermissionsServiceName;
    state?: PermissionState | 'error';

    onChange(property: string) {
        if (property !== 'permission') {
            return;
        }

        this.#unsub();

        if (this.permission && this.#permissionsService[this.permission]) {
            this.#subscription = this.#permissionsService
                [this.permission]()
                .subscribe((state) => (this.state = state));
        } else {
            this.state = 'error';
        }
    }

    onDestroy() {
        this.#unsub();
    }

    #unsub() {
        if (this.#subscription) {
            this.#subscription.unsubscribe();
            this.#subscription = undefined;
        }
    }
}
