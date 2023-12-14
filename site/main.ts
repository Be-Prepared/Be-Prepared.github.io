import { bootstrap } from '../src/index';

bootstrap();

// Enable Eruda (a developer console) when "eruda=true" is in the URL.
const src = '//cdn.jsdelivr.net/npm/eruda';

if (
    /eruda=true/.test(window.location.toString()) ||
    localStorage.getItem('active-eruda') === 'true'
) {
    const script = document.createElement('script')
    script.src = '//cdn.jsdelivr.net/npm/eruda';
    script.onload = () => (window as any).eruda.init();
    document.body.append(script);
}
