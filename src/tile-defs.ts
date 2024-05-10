import { AvailabilityState } from './datatypes/availability-state';
import { BarcodeReaderService } from './services/barcode-reader.service';
import { di } from 'fudgel';
import { MagnifierService } from './services/magnifier.service';
import { map } from 'rxjs/operators';
// import { NfcService } from './services/nfc.service';
import { GeolocationService } from './services/geolocation.service';
import { Observable, of } from 'rxjs';
// import {
//     PermissionsService,
//     PermissionsServiceState,
// } from './services/permissions.service';
import { PositionService } from './services/position.service';
import { TorchService } from './services/torch.service';

const barcodeReaderService = di(BarcodeReaderService);
const geolocationService = di(GeolocationService);
const magnifierService = di(MagnifierService);
// const nfcService = di(NfcService);
// const permissionsService = di(PermissionsService);
const positionService = di(PositionService);
const torchService = di(TorchService);

const availabilityToBoolean = map(
    (state: AvailabilityState) =>
        state === AvailabilityState.ALLOWED ||
        state === AvailabilityState.PROMPT
);
// const permissionToBoolean = map(
//     (state: PermissionsServiceState) =>
//         state === PermissionsServiceState.GRANTED ||
//         state === PermissionsServiceState.PROMPT
// );

export interface TileDef {
    id: string;
    icon: string;
    label: string;
    component: string;
    show: Observable<boolean>;
}

export const tileDefs: TileDef[] = [
    {
        id: 'flashlight',
        icon: '/flashlight.svg',
        label: 'tile.flashlight',
        component: 'flashlight-app',
        show: torchService.availabilityState(false).pipe(availabilityToBoolean),
    },
    {
        id: 'frontLight',
        icon: '/front-light.svg',
        label: 'tile.frontLight',
        component: 'front-light-app',
        show: of(true),
    },
    {
        id: 'magnifier',
        icon: '/magnifier.svg',
        label: 'tile.magnifier',
        component: 'magnifier-app',
        show: magnifierService
            .availabilityState(false)
            .pipe(availabilityToBoolean),
    },
    {
        id: 'mirror',
        icon: '/mirror.svg',
        label: 'tile.mirror',
        component: 'mirror-app',
        show: of(false),
    },
    {
        id: 'compass',
        icon: '/compass.svg',
        label: 'tile.compass',
        component: 'compass-app',
        show: positionService.availabilityState().pipe(availabilityToBoolean),
    },
    {
        id: 'location',
        icon: '/location.svg',
        label: 'tile.location',
        component: 'location-app',
        show: geolocationService
            .availabilityState()
            .pipe(availabilityToBoolean),
    },
    {
        id: 'barcode-reader',
        icon: '/barcode-reader.svg',
        label: 'tile.barcodeReader',
        component: 'barcode-reader-app',
        show: barcodeReaderService
            .availabilityState(false)
            .pipe(availabilityToBoolean),
    },
    {
        id: 'nfc',
        icon: '/nfc.svg',
        label: 'tile.nfc',
        component: 'nfc-app',
        show: of(false),
        // show: nfcService.availabilityState().pipe(availabilityToBoolean),
    },
    {
        id: 'timer',
        icon: '/timer.svg',
        label: 'tile.timer',
        component: 'timer-app',
        show: of(false),
    },
    {
        id: 'metal-detector',
        icon: '/metal-detector.svg',
        label: 'tile.metalDetector',
        component: 'metal-detector-app',
        show: of(false),
    },
    {
        id: 'speed',
        icon: '/speed.svg',
        label: 'tile.speed',
        component: 'speed-app',
        show: of(false),
    },
    {
        id: 'level',
        icon: '/level.svg',
        label: 'tile.level',
        component: 'level-app',
        show: of(false),
    },
    {
        id: 'stopwatch',
        icon: '/stopwatch.svg',
        label: 'tile.stopwatch',
        component: 'stopwatch-app',
        show: of(false),
    },
    {
        id: 'temperature',
        icon: '/temperature.svg',
        label: 'tile.temperature',
        component: 'temperature-app',
        show: of(false),
    },
    {
        id: 'ruler',
        icon: '/ruler.svg',
        label: 'tile.ruler',
        component: 'ruler-app',
        show: of(false),
    },
    {
        id: 'sun-moon',
        icon: '/sun-moon.svg',
        label: 'tile.sunMoon',
        component: 'sun-moon-app',
        show: of(true),
    },
    {
        id: 'info',
        icon: '/info.svg',
        label: 'tile.info',
        component: 'info-app',
        show: of(true),
    },
];
