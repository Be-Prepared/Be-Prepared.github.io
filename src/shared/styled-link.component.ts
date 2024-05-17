import { Component, css } from 'fudgel';

@Component('styled-link', {
    attr: ['href', 'target'],
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
    template: ' <a href="{{hrefHijacked}}" target="{{target}}"><slot></slot></a> ',
    useShadow: true,
})
export class StyledLinkComponent {
    href?: string = '#';
    hrefHijacked = '#';
    target?: string;

    onChange(prop: string) {
        if (prop === 'href') {
            this._setHref(this.href || '#');
        }
    }

    private _setHref(href: string) {
        if (href.startsWith('geo:')) {
            this.hrefHijacked = `/location-add?location=${href.slice(4)}`
        }

        this.hrefHijacked = this.href || '#';
    }
}
