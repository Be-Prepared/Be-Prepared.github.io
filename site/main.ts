import { bootstrap } from '../src/index';

// Handle 404 redirections for hosting a single page app on GitHub.
// https://www.smashingmagazine.com/2016/08/sghpa-single-page-app-hack-github-pages/
var redirect = sessionStorage.redirect;
delete sessionStorage.redirect;

if (redirect && redirect != location.href) {
    history.pushState(null, null, redirect);
}

bootstrap();

// Enable Eruda (a developer console) when "eruda=true" is in the URL.
const src = '//cdn.jsdelivr.net/npm/eruda';

if (window.location.toString().indexOf('eruda') >= 0) {
    const script = document.createElement('script');
    script.src = '//cdn.jsdelivr.net/npm/eruda';
    script.onload = () => (window as any).eruda.init();
    document.body.append(script);
}
