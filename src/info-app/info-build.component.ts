import { Component, css, html } from 'fudgel';

@Component('info-build', {
    style: css``,
    template: html`
        <info-header
            id="info.buildInformationHeader"
            @click="tap()"
        ></info-header>
        <ul>
            <li>
                {{buildDate}}, commit
                <styled-link
                    href="https://github.com/Be-Prepared/Be-Prepared/commit/{{version}}"
                    target="_blank"
                    >{{shortVersion}}</styled-link
                >
            </li>
            <li>Node.js {{nodeVersion}} ({{hostPlatform}} {{hostArch}})</li>
        </ul>
    `,
})
export class InfoBuildComponent {
    buildDate = __BUILD_DATE__;
    hostPlatform = __HOST_PLATFORM__;
    hostArch = __HOST_ARCH__;
    nodeVersion = __NODE_VERSION__;
    shortVersion = __BE_PREPARED_VERSION__.substr(0, 7);
    tapCount = 0;
    version = __BE_PREPARED_VERSION__;
    website = __WEBSITE__;

    tap() {
        this.tapCount++;
        const eruda = 'eruda';

        if (this.tapCount > 9) {
            const enabled = sessionStorage.getItem(eruda);

            if (enabled) {
                sessionStorage.removeItem(eruda);
            } else {
                sessionStorage.setItem(eruda, '1');
            }

            window.location.reload();
        }
    }
}
