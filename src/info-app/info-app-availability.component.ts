import { AvailabilityState } from '../datatypes/availability-state';
import { Component, css, html, Prop } from 'fudgel';

@Component('info-app-availability', {
    style: css`
        .state_granted {
            color: green;
        }

        .state_granted::before {
            content: '✔ ';
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
            content: '✖ ';
        }

        .state_unavailable {
            color: gray;
        }
    `,
    template: html`
        <span class="state_{{this.stateStr}}">{{this.stateStr}}</span>
    `,
})
export class InfoAppAvailabilityComponent {
    @Prop() availabilityState = AvailabilityState.ERROR;
    stateStr = 'error';

    onChange() {
        if (this.availabilityState === AvailabilityState.UNAVAILABLE) {
            this.stateStr = 'unavailable';
        } else if (this.availabilityState === AvailabilityState.DENIED) {
            this.stateStr = 'denied';
        } else if (this.availabilityState === AvailabilityState.PROMPT) {
            this.stateStr = 'prompt';
        } else if (this.availabilityState === AvailabilityState.GRANTED) {
            this.stateStr = 'granted';
        } else {
            this.stateStr = 'error';
        }
    }
}
