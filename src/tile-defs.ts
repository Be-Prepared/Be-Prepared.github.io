import { AvailabilityState } from './datatypes/availability-state';
import { di } from 'fudgel';
import { map } from 'rxjs/operators';
import { Observable, of } from 'rxjs';
// import {
//     PermissionsService,
//     PermissionsServiceState,
// } from './services/permissions.service';
import { TorchService } from './services/torch.service';

// const permissionsService = di(PermissionsService);
const torchService = di(TorchService);

const availabilityToBoolean = map(
    (state: AvailabilityState) =>
        state === AvailabilityState.GRANTED || state === AvailabilityState.PROMPT);
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
        icon: 'flashlight.svg',
        label: 'tile.flashlight',
        component: 'flashlight-app',
        show: torchService.availabilityState().pipe(availabilityToBoolean)
    },
    {
        id: 'frontLight',
        icon: 'front-light.svg',
        label: 'tile.frontLight',
        component: 'front-light-app',
        show: of(true),
    },
    {
        id: 'magnifier',
        icon: 'magnifier.svg',
        label: 'tile.magnifier',
        component: 'magnifier-app',
        show: of(false),
    },
    {
        id: 'mirror',
        icon: 'mirror.svg',
        label: 'tile.mirror',
        component: 'mirror-app',
        show: of(false),
    },
    {
        id: 'compass',
        icon: 'compass.svg',
        label: 'tile.compass',
        component: 'compass-app',
        show: of(false),
    },
    {
        id: 'location',
        icon: 'location.svg',
        label: 'tile.location',
        component: 'location-app',
        show: of(false),
    },
    {
        id: 'qrCode',
        icon: 'qr-code.svg',
        label: 'tile.qrCode',
        component: 'qr-code-app',
        show: of(false),
    },
    {
        id: 'nfc',
        icon: 'nfc.svg',
        label: 'tile.nfc',
        component: 'nfc-app',
        show: of(false),
    },
    {
        id: 'timer',
        icon: 'timer.svg',
        label: 'tile.timer',
        component: 'timer-app',
        show: of(false),
    },
    {
        id: 'metal-detector',
        icon: 'metal-detector.svg',
        label: 'tile.metalDetector',
        component: 'metal-detector-app',
        show: of(false),
    },
    {
        id: 'speed',
        icon: 'speed.svg',
        label: 'tile.speed',
        component: 'speed-app',
        show: of(false),
    },
    {
        id: 'level',
        icon: 'level.svg',
        label: 'tile.level',
        component: 'level-app',
        show: of(false),
    },
    {
        id: 'stopwatch',
        icon: 'stopwatch.svg',
        label: 'tile.stopwatch',
        component: 'stopwatch-app',
        show: of(false),
    },
    {
        id: 'temperature',
        icon: 'temperature.svg',
        label: 'tile.temperature',
        component: 'temperature-app',
        show: of(false),
    },
    {
        id: 'ruler',
        icon: 'ruler.svg',
        label: 'tile.ruler',
        component: 'ruler-app',
        show: of(false),
    },
    {
        id: 'info',
        icon: 'info.svg',
        label: 'tile.info',
        component: 'info-app',
        show: of(true),
    },
];
