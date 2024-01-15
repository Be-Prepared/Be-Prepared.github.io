import { AvailabilityState } from '../datatypes/availability-state';
import { Component, css, html } from 'fudgel';

@Component('info-app-availability', {
    prop: ['availabilityState'],
    style: css`
        .state_allowed {
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

        .state_unavailable {
            color: gray;
        }
    `,
    template: html`
        <span class="state_{{this.stateStr}}"
            ><i18n-label id="info.availability.{{this.stateStr}}"></i18n-label
        ></span>
    `,
})
export class InfoAppAvailabilityComponent {
    availabilityState = AvailabilityState.ERROR;
    stateStr = 'error';

    onChange() {
        if (this.availabilityState === AvailabilityState.UNAVAILABLE) {
            this.stateStr = 'unavailable';
        } else if (this.availabilityState === AvailabilityState.DENIED) {
            this.stateStr = 'denied';
        } else if (this.availabilityState === AvailabilityState.PROMPT) {
            this.stateStr = 'prompt';
        } else if (this.availabilityState === AvailabilityState.ALLOWED) {
            this.stateStr = 'allowed';
        } else {
            this.stateStr = 'error';
        }
    }
}
