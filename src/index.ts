export * from './app/app.module';
export * from './shared/shared.module';
export { bootstrap } from './bootstrap';

import { defineRouterComponent } from './router';

defineRouterComponent('app-router');
