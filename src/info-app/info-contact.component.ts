import { Component, css, html } from 'fudgel';

@Component('info-contact', {
    style: css``,
    template: html`
        <p><i18n-label id="info.contact.specificBrowsers"></i18n-label></p>
        <p><i18n-label id="info.contact.feedback"></i18n-label></p>
        <ul>
            <li>
                <styled-link
                    href="https://github.com/Be-Prepared/Be-Prepared.github.io/issues"
                    target="_blank"
                    ><i18n-label id="info.contact.issues"></i18n-label
                ></styled-link>
            </li>
            <li>
                <styled-link href="mailto:fidian@rumkin.com"
                    ><i18n-label id="info.contact.email"></i18n-label
                ></styled-link>
            </li>
        </ul>
    `,
})
export class InfoContactComponent {}
