import { Component, css, html } from 'fudgel';

@Component('info-tooling', {
    style: css``,
    template: html`
        <info-header id="info.toolingHeader"></info-header>
        <ul>
            <li>
                <styled-link
                    href="https://github.com/be-Prepared/Be-Prepared.github.io/"
                    target="_blank"
                    >GitHub</styled-link
                >
                - <i18n-label id="info.sourceCode"></i18n-label>
            </li>
            <li>
                <styled-link href="https://fudgel.js.org" target="_blank"
                    >Fudgel</styled-link
                >
                - <i18n-label id="info.framework"></i18n-label>
            </li>
        </ul>
    `,
})
export class InfoToolingComponent {}
