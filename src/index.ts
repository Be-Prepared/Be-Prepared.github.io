export * from './app-index/app-index.module';
export * from './app-root/app-root.module';
export * from './barcode-reader-app/barcode-reader-app.module';
export * from './compass-app/compass-app.module';
export * from './flashlight-app/flashlight-app.module';
export * from './front-light-app/front-light-app.module';
export * from './i18n/i18n.module';
export * from './info-app/info-app.module';
export * from './install-pwa/install-pwa.module';
export * from './location-app/location-app.module';
export * from './location-field/location-field.module';
export * from './magnifier-app/magnifier-app.module';
export * from './nfc-app/nfc-app.module';
export * from './file-transfer-app/file-transfer-app.module';
export * from './shared/shared.module';
export * from './sun-moon-app/sun-moon-app.module';
export * from './update-pwa/update-pwa.module';

export { bootstrap } from './bootstrap';
import { defineRouterComponent } from 'fudgel';
export { storage } from './services/local-storage.service';

defineRouterComponent('app-router');
