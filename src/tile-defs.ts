import { PermissionsServiceName } from './services/permissions.service';

export interface TileDef {
    id: string;
    icon: string;
    label: string;
    component: string;
    show: boolean | PermissionsServiceName[];
}

export const tileDefs: TileDef[] = [
    {
        id: 'flashlight',
        icon: 'flashlight.svg',
        label: 'tile.flashlight',
        component: 'flashlight-app',
        show: ['torch'],
    },
    {
        id: 'frontLight',
        icon: 'front-light.svg',
        label: 'tile.frontLight',
        component: 'front-light-app',
        show: true,
    },
    {
        id: 'magnifier',
        icon: 'magnifier.svg',
        label: 'tile.magnifier',
        component: 'magnifier-app',
        show: false,
    },
    {
        id: 'mirror',
        icon: 'mirror.svg',
        label: 'tile.mirror',
        component: 'mirror-app',
        show: false,
    },
    {
        id: 'compass',
        icon: 'compass.svg',
        label: 'tile.compass',
        component: 'compass-app',
        show: false,
    },
    {
        id: 'location',
        icon: 'location.svg',
        label: 'tile.location',
        component: 'location-app',
        show: false,
    },
    {
        id: 'qrCode',
        icon: 'qr-code.svg',
        label: 'tile.qrCode',
        component: 'qr-code-app',
        show: false,
    },
    {
        id: 'nfc',
        icon: 'nfc.svg',
        label: 'tile.nfc',
        component: 'nfc-app',
        show: false,
    },
    {
        id: 'timer',
        icon: 'timer.svg',
        label: 'tile.timer',
        component: 'timer-app',
        show: false,
    },
    {
        id: 'metal-detector',
        icon: 'metal-detector.svg',
        label: 'tile.metalDetector',
        component: 'metal-detector-app',
        show: false,
    },
    {
        id: 'speed',
        icon: 'speed.svg',
        label: 'tile.speed',
        component: 'speed-app',
        show: false,
    },
    {
        id: 'level',
        icon: 'level.svg',
        label: 'tile.level',
        component: 'level-app',
        show: false,
    },
    {
        id: 'stopwatch',
        icon: 'stopwatch.svg',
        label: 'tile.stopwatch',
        component: 'stopwatch-app',
        show: false,
    },
    {
        id: 'temperature',
        icon: 'temperature.svg',
        label: 'tile.temperature',
        component: 'temperature-app',
        show: false,
    },
    {
        id: 'ruler',
        icon: 'ruler.svg',
        label: 'tile.ruler',
        component: 'ruler-app',
        show: false,
    },
    {
        id: 'info',
        icon: 'info.svg',
        label: 'tile.info',
        component: 'info-app',
        show: true,
    },
];
