// A very simplistic router that relies on history state, designed for use within a lightweight single page app.
//
// To use, you will first need to import the router and define its name. It's bundled this way so you could theoretically mix your components or ensure there's never a conflict.
//
//     import { defineRouterComponent } from 'fudgel';
//
//     // Defines this custom element as <app-router>
//     defineRouterComponent('app-router');
//
// From here you would include the custom component and it will pick *at most
// one* child to display, depending on the first route that matches. Wildcards
// are supported, with `*` matching any non-slash characters and `**` matching
// anything. Using `**` as your default will guarantee that the page catches
// all non-routed URLs.
//
//     <app-router>
//         <div path="/page1">Page 1 - <a href="/page2">Go to page 2</a></div>
//         <div path="/page2">Page 2 - <a href="/unknown-page">Try a broken link</a></div>
//         <div path="/user/*">Users are shown here</div>
//         <div path="**">This is the default page. <a href="/page1">Go to Page 1</a></div>
//     </app-router>
//
// This is geared for web components, so the child routes can initialize a
// custom element. Lazy loading is also supported and the file will be imported
// if the custom element does not yet exist.
//
//     <app-router>
//         <div path="/info" component="info-page"></div>
//         <div path="/admin" component="admin-section" import="./admin.js"></div>
//     </app-router>
//
// Routes can use regular expressions by including an `regexp` attribute. Named
// route parameters also work and are passed to custom elements. When using
// named parameters, the attribute is set automatically on the custom elements.
// In this case, `<edit-page>` will have the attribute `pageId` added.
//
//     <app-router>
//         <div path="/user-([^/]*)" regexp></div>
//         <div path="/edit/:pageId" component="edit-page"></div>
//     </app-router>
//
// Navigation can be done by the user clicking on `<a href="...">` links, which
// is detected automatically with a click event handler on `document.body`. You
// can also use `pushState()`, `popState()` and `replaceState()` on
// `window.history`. This also covers the usage of the browser's history, back,
// and forward buttons. You can also get a reference to the router element and
// call `go(url)` to navigate.
//
//     history.go(-1);
//     document.querySelector('app-router').go('/edit/profile');
//
// This web component is built on the work of these other projects. They have a
// lot more features than this simple router, so if you need fancier things, I
// suggest you look at one of these.
//
// https://github.com/colscott/a-wc-router
//
// https://github.com/markcellus/router-component
//
// https://github.com/jasimea/router-sample
// - as featured on Medium
//   https://medium.com/@jasim/declarative-router-with-web-components-43ddcebc9dbc
//
// https://github.com/erikringsmuth/app-router

interface MatchedRoute {
    e: Element;
    g: [string, string][];
}

class RouterComponent extends HTMLElement {
    #fragment = document.createDocumentFragment();
    #routeElements: Element[] = [];
    #undo: (() => void)[] = [];

    constructor() {
        super();
        const children = this.children;

        while (children.length > 0) {
            const element = children[0];
            this.#routeElements.push(element);
            this.#fragment.appendChild(element);
        }
    }

    connectedCallback() {
        this.#listen(window, 'popstate', this.#popState);
        this.#listen(document.body, 'click', this.#clickedLink);
        this.#route(window.location.pathname);
        this.#patch(window.history, 'pushState', this.#modifyStateGenerator);
        this.#patch(window.history, 'replaceState', this.#modifyStateGenerator);
    }

    disconnectedCallback() {
        while (this.#undo) {
            this.#undo.pop()!();
        }
    }

    go(url: string) {
        window.history.pushState(null, document.title, url);
    }

    #activate(matchedRoute: MatchedRoute) {
        // FIXME minify getAttribute
        const title = matchedRoute.e.getAttribute('title');
        const component = matchedRoute.e.getAttribute('component');
        const importUrl = matchedRoute.e.getAttribute('import');
        this.innerHTML = '';
        const updateView = () => {
            if (title) {
                document.title = title;
            }

            const e = component
                ? document.createElement(component)
                : (matchedRoute.e.cloneNode(true) as Element);

            for (const [key, value] of matchedRoute.g) {
                // FIXME minify camelToDash
                e.setAttribute(key.replace(/\p{Lu}/gu, match => `-${match[0]}`.toLowerCase()), value);
            }

            this.appendChild(e);
        };

        if (importUrl && component && !customElements.get(component)) {
            import(importUrl).then(updateView);
        } else {
            updateView();
        }
    }

    #clickedLink(e: Event) {
        if (!e.defaultPrevented) {
            const link = e
                .composedPath()
                .filter((n: any) => (n as HTMLElement).tagName === 'A')[0] as
                | HTMLAnchorElement
                | undefined;

            if (link) {
                // FIXME minify window/location
                const location = window.location;

                if (link.href && link.origin !== location.origin) {
                    e.preventDefault();
                    this.go(`${link.pathname}${link.search}${link.hash}`);
                }
            }
        }
    }

    #listen(
        target: Window | HTMLElement,
        eventName: string,
        unboundListener: (...args: any[]) => void
    ): void {
        const boundListener = unboundListener.bind(this);
        target.addEventListener(eventName, boundListener);
        this.#undo.push(() =>
            target.removeEventListener(eventName, boundListener)
        );
    }

    #match(url: string): MatchedRoute | null {
        for (const routeElement of this.#routeElements) {
            const path = routeElement.getAttribute('path') || '**';
            const regexpAttr = routeElement.getAttribute('regexp');
            let regexpStr = path;

            if (typeof regexpAttr !== 'string') {
                regexpStr = path
                    .replace(/\*\*?/g, (match) =>
                        match.length > 1 ? '.*' : '[^/]*'
                    )
                    .replace(/:([^:/]+)/g, (match) => `(?<${match[1]}>[^/]*)`);
            }

            const regexp = new RegExp(`^${regexpStr}$`);
            const match = url.match(regexp);

            if (match) {
                return {
                    e: routeElement,
                    g: Object.entries(match.groups || {}),
                };
            }
        }

        return null;
    }

    #modifyStateGenerator(
        target: object,
        original: (state: any, title: string, url?: string | null) => void
    ) {
        return (state: any, title: string, url?: string | null) => {
            original.call(target, state, title, url);
            this.#route(url || '/');
        };
    }

    #patch(
        target: object,
        methodName: string,
        generator: (
            target: object,
            original: (...args: any[]) => any
        ) => (...args: any[]) => any
    ) {
        const original = (target as any)[methodName];
        (target as any)[methodName] = generator.call(this, target, original);
        this.#undo.push(() => ((target as any)[methodName] = original));
    }

    #popState() {
        this.#route(window.location.pathname);
    }

    #route(url: string) {
        const matchedRoute = this.#match(url);

        if (matchedRoute) {
            this.#activate(matchedRoute);
        }
    }
}

export const defineRouterComponent = (name = 'router-outlet') => {
    customElements.define(name, RouterComponent);
};
