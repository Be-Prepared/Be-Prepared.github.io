import { bootstrap } from '../src/index';

// Handle 404 redirections for hosting a single page app on GitHub.
// https://www.smashingmagazine.com/2016/08/sghpa-single-page-app-hack-github-pages/
const redirectKey = 'redirect';
const redirect = sessionStorage.getItem(redirectKey);
sessionStorage.removeItem(redirectKey);

if (redirect && redirect !== location.href) {
    history.pushState(null, null, redirect);
}

let started = false;
const startApp = () => {
    if (started) {
        return;
    }

    started = true;
    bootstrap().then(() =>
        document.body.append(document.createElement('app-root'))
    );
};

// Enable Eruda (a developer console) when "eruda" is in the URL or flagged via
// sessionStorage (Info's build information header toggles it with 10 taps).
const src = '//cdn.jsdelivr.net/npm/eruda';
const eruda = 'eruda';
let erudaFlagged = false;

try {
    erudaFlagged = !!sessionStorage.getItem(eruda);
} catch (_ignore) {}

if (window.location.toString().indexOf(eruda) >= 0 || erudaFlagged) {
    try {
        sessionStorage.setItem(eruda, '1');
    } catch (_ignore) {
        sessionStorage.clear();
    }

    const script = document.createElement('script');
    script.src = src;
    script.onload = () => {
        try {
            (window as any).eruda.init();
        } catch (_ignore) {}

        startApp();
    };
    // Offline, the console can't load. Start the app without it.
    script.onerror = startApp;
    document.body.append(script);
} else {
    startApp();
}
