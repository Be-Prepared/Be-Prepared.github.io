import { Attr, Component, css, html } from 'fudgel';

@Component('scaling-icon', {
    style: css`
        :host {
            display: block;
        }

        .icon {
            height: 128px;
            width: 128px;
        }

        @media (max-width: 960px) {
            .icon {
                height: 96px;
                width: 96px;
            }
        }

        @media (max-width: 480px) {
            .icon {
                height: 25vw;
                width: 25vw;
            }
        }
    `,
    template: html`
        <load-svg class="icon" href="{{this.href}}"></load-svg>
    `
})
export class ScalingIconComponent {
    @Attr() href?: string;
}
