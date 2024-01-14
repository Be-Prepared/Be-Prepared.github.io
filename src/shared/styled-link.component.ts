import { Component, css } from 'fudgel';

@Component('styled-link', {
    attr:['href', 'target'],
    style: css`
        :host {
            display: inline;
        }

        a {
            color: var(--link-color);
            text-decoration: none;
        }
    `,
    // The spaces at the ends are important because this is an inline element,
    // but vite/esbuild doesn't treat it as such and will remove surrounding
    // spaces.
    template: ' <a href="{{this.href || "#"}}" target="{{this.target}}"><slot></slot></a> ',
})
export class StyledLinkComponent {
    href?: string;
    target?: string;
}
