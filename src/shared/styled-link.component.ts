import { Component, css, html } from 'fudgel';

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
    template: html`
        {{ws}}
        <a *if="hijackGeo" href="/location-add/{{hrefGeo}}"><slot></slot></a>
        <a *if="!hijackGeo" href="{{href}}" target="{{target}}"><slot></slot></a
        >{{ws}}
    `,
    useShadow: true,
})
export class StyledLinkComponent {
    hrefGeo?: string;
    hijackGeo = false;
    href?: string = '#';
    target?: string;
    ws = ' ';

    onChange(prop: string) {
        if (prop === 'href') {
            this._setHref(this.href || '#');
        }
    }

    private _setHref(href: string) {
        if (href.startsWith('geo:')) {
            this.hrefGeo = href.slice(4);
            this.hijackGeo = true;
        } else {
            this.hijackGeo = false;
        }
    }
}
