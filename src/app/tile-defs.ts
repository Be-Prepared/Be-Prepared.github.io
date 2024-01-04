interface TileDef {
    id: string;
    icon: string;
    label: string;
    component: string;
    show: boolean;
}

export const tileDefs: TileDef[] = [
    {
        id: 'flashlight',
        icon: 'flashlight.svg',
        label: 'tile.flashlight',
        component: 'app-flashlight',
        show: false,
    },
    {
        id: 'frontLight',
        icon: 'front-light.svg',
        label: 'tile.frontLight',
        component: 'app-front-light',
        show: true,
    },
    {
        id: 'magnifier',
        icon: 'magnifier.svg',
        label: 'tile.magnifier',
        component: 'app-magnifier',
        show: false,
    },
    {
        id: 'mirror',
        icon: 'mirror.svg',
        label: 'tile.mirror',
        component: 'app-mirror',
        show: false,
    },
    {
        id: 'compass',
        icon: 'compass.svg',
        label: 'tile.compass',
        component: 'app-compass',
        show: false,
    },
    {
        id: 'location',
        icon: 'location.svg',
        label: 'tile.location',
        component: 'app-location',
        show: false,
    },
    {
        id: 'qrCode',
        icon: 'qr-code.svg',
        label: 'tile.qrCode',
        component: 'app-qr-code',
        show: false,
    },
    {
        id: 'nfc',
        icon: 'nfc.svg',
        label: 'tile.nfc',
        component: 'app-nfc',
        show: false,
    },
    {
        id: 'timer',
        icon: 'timer.svg',
        label: 'tile.timer',
        component: 'app-timer',
        show: false,
    },
    {
        id: 'metal-detector',
        icon: 'metal-detector.svg',
        label: 'tile.metalDetector',
        component: 'app-metal-detector',
        show: false,
    },
    {
        id: 'speed',
        icon: 'speed.svg',
        label: 'tile.speed',
        component: 'app-speed',
        show: false,
    },
    {
        id: 'level',
        icon: 'level.svg',
        label: 'tile.level',
        component: 'app-level',
        show: false,
    },
    {
        id: 'stopwatch',
        icon: 'stopwatch.svg',
        label: 'tile.stopwatch',
        component: 'app-stopwatch',
        show: false,
    },
    {
        id: 'temperature',
        icon: 'temperature.svg',
        label: 'tile.temperature',
        component: 'app-temperature',
        show: false,
    },
    {
        id: 'ruler',
        icon: 'ruler.svg',
        label: 'tile.ruler',
        component: 'app-ruler',
        show: false,
    },
    {
        id: 'info',
        icon: 'info.svg',
        label: 'tile.info',
        component: 'app-info',
        show: true,
    },
];
