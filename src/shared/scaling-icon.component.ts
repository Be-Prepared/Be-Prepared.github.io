import { component, css, html } from 'fudgel';

export class ScalingIconComponent {
    href?: string;
}

component('scaling-icon', {
    attr: ['href'],
    style: css`
        :host {
            display: block;
        }

        .icon {
            height: 128px;
            height: 25vmin;
            max-height: 128px;
            width: 128px;
            width: 25vmin;
            max-width: 128px;
        }
    `,
    template: html` <load-svg class="icon" href="{{href}}"></load-svg> `,
}, ScalingIconComponent);
