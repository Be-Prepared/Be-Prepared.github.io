import { Component, css, html } from 'fudgel';
import { di } from '../di';
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
        <span class="state_{{stateStr}}"
            ><i18n-label id="info.permission.{{stateStr}}"></i18n-label
        ></span>
    `,
})
export class InfoAppPermissionComponent {
    private _permissionsService = di(PermissionsService);
    private _subscription?: Subscription;
    permission?: PermissionsServiceName;
    stateStr = 'error';

    onChange(property: string) {
        if (property === 'permission') {
            this._unsub();

            if (this.permission && this._permissionsService[this.permission]) {
                this._subscription = this._permissionsService[
                    this.permission
                ]().subscribe((state) => this._setState(state));
            } else {
                this._setState(PermissionsServiceState.ERROR);
            }
        }
    }

    onDestroy() {
        this._unsub();
    }

    private _setState(state: PermissionsServiceState) {
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

    private _unsub() {
        if (this._subscription) {
            this._subscription.unsubscribe();
            this._subscription = undefined;
        }
    }
}
