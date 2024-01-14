import type { LanguageData } from './language-data';

export const enUS: LanguageData = {
    // Application-related and global strings
    'app.title': 'Be Prepared',
    'app.currentPermissionStatus': 'Current permission status',

    // Flashlight
    'flashlight.explainAsk':
        'In order to turn on the flashlight, the camera permission needs to be granted.',
    'flashlight.explainDeny':
        "The camera permission is required to access the camera's light. The permission was denied or your device does not have a light.",
    'flashlight.turnOff': 'Turn Off',
    'flashlight.turnOn': 'Turn On',
    'flashlight.unavailable': 'Not Available',
    'flashlight.unavailableMessage':
        'This device does not have a camera with a flashlight that is accessible to the application. Because this feature is not available, the button will be removed from the menu.',

    // Info
    'info.camera': 'Camera:',
    'info.framework': 'the framework driving this app',
    'info.permissionsHeader': 'Permissions:',
    'info.svgCompression': 'SVG compression',
    'info.torch': 'Torch:',
    'info.toolingHeader': 'Tooling:',

    // Install
    'install.action': 'Install',
    'install.message': 'Install to Home Screen',

    // Permission denied
    'permissionDenied.heading': 'Permission Denied',
    'permissionDenied.message':
        'Because the necessary permission was denied, the button in the menu will be removed. If this was done by mistake, you will need to go load the site in a web browser and manually reset the permissions. This is not something that the application can do for you.',

    // Permission prompt
    'permissionPrompt.goBack': 'Not Right Now',
    'permissionPrompt.grantPermission': 'Grant Permission',
    'permissionPrompt.heading': 'Permission Required',

    // Tile labels on index
    'tile.compass': 'Compass',
    'tile.flashlight': 'Flashlight',
    'tile.frontLight': 'Front Light',
    'tile.info': 'Info',
    'tile.level': 'Level',
    'tile.location': 'Location',
    'tile.magnifier': 'Magnifier',
    'tile.metalDetector': 'Metal Detector',
    'tile.mirror': 'Mirror',
    'tile.nfc': 'NFC',
    'tile.qrCode': 'QR Code',
    'tile.ruler': 'Ruler',
    'tile.speed': 'Speed',
    'tile.stopwatch': 'Stopwatch',
    'tile.temperature': 'Temperature',
    'tile.timer': 'Timer',
};
