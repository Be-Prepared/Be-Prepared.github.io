import { bootstrap } from '../src/index';

// Handle 404 redirections for hosting a single page app on GitHub.
// https://www.smashingmagazine.com/2016/08/sghpa-single-page-app-hack-github-pages/
var redirect = sessionStorage.redirect;
delete sessionStorage.redirect;

if (redirect && redirect != location.href) {
    history.pushState(null, null, redirect);
}

bootstrap();
