export * from './app/app.module';
export * from './app-front-light/app-front-light.module';
export * from './app-info/app-info.module';
export * from './shared/shared.module';
export { bootstrap } from './bootstrap';
import { defineRouterComponent } from 'fudgel';

defineRouterComponent('app-router');
