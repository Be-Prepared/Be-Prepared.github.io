export * from './app-index/app-index.module';
export * from './app-root/app-root.module';
export * from './flashlight-app/flashlight-app.module';
export * from './front-light-app/front-light-app.module';
export * from './i18n/i18n.module';
export * from './info-app/info-app.module';
export * from './install-pwa/install-pwa.module';
export * from './shared/shared.module';

export { bootstrap } from './bootstrap';
import { defineRouterComponent } from 'fudgel';

defineRouterComponent('app-router');
