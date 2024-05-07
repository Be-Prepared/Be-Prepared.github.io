export * from './app-index/app-index.module';
export * from './app-root/app-root.module';
export * from './compass-app/compass-app.module';
export * from './flashlight-app/flashlight-app.module';
export * from './front-light-app/front-light-app.module';
export * from './i18n/i18n.module';
export * from './info-app/info-app.module';
export * from './install-pwa/install-pwa.module';
export * from './location-app/location-app.module';
export * from './magnifier-app/magnifier-app.module';
export * from './shared/shared.module';
export * from './sun-moon-app/sun-moon-app.module';
export * from './update-pwa/update-pwa.module';

export { bootstrap } from './bootstrap';
import { defineRouterComponent } from 'fudgel';

defineRouterComponent('app-router');
