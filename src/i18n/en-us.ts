import type { LanguageData } from './language-data';

export const enUS: LanguageData = {
    // Application-related and global strings
    'app.title': 'Be Prepared',
    'app.currentPermissionStatus': 'Current permission status',

    // Camera unavailable
    'cameraUnavailable.heading': 'No Suitable Camera',
    'cameraUnavailable.message':
        'There is no camera available that this app can use for the selected tool. This tool will be removed from the starting menu.',

    // Flashlight
    'flashlight.explainAsk':
        'In order to turn on the flashlight, the camera permission needs to be granted.',
    'flashlight.explainDeny':
        "The camera permission is required to access the camera's light. The permission was denied or your device does not have a light.",
    'flashlight.unavailable': 'Not Available',
    'flashlight.unavailableMessage':
        'This device does not have a camera with a flashlight that is accessible to the application. Because this feature is not available, the button will be removed from the menu.',

    // Info
    'info.availability.allowed': '✔ Allowed',
    'info.availability.denied': '✖ Denied',
    'info.availability.error': 'Error',
    'info.availability.prompt': 'Prompt',
    'info.availability.unavailable': 'Unavailable',
    'info.buildInformationHeader': 'Build Information',
    'info.camera': 'Camera:',
    'info.coordinates': 'Coordinates:',
    'info.coordinates.DDD': 'Decimal Degrees',
    'info.coordinates.DDM': 'Degrees Decimal Minutes',
    'info.coordinates.DMS': 'Degrees Minutes Seconds',
    'info.coordinates.MGRS': 'MGRS',
    'info.coordinates.UTM/UPS': 'UTM/UPS',
    'info.distances': 'Distances:',
    'info.distances.imperial': 'Imperial',
    'info.distances.metric': 'Metric',
    'info.framework': 'the framework driving this app',
    'info.geolocation': 'Geolocation:',
    'info.permission.denied': '✖ Denied',
    'info.permission.error': 'Error',
    'info.permission.granted': '✔ Granted',
    'info.permission.prompt': 'Prompt',
    'info.permissionsAndFeaturesHeader': 'Permissions and Features:',
    'info.position': 'Position:',
    'info.preferences': 'Preferences:',
    'info.shareApp': 'Share This App:',
    'info.shareCopied': 'Website copied to clipboard',
    'info.sourceCode': 'source code',
    'info.svgCompression': 'SVG compression',
    'info.torch': 'Torch:',
    'info.toolingHeader': 'Tooling:',
    'info.wakeLock': 'Wake Lock:',

    // Install
    'install.action': 'Install',
    'install.message': 'Install to Home Screen',

    // Location
    'location.addEdit.name': 'Waypoint Name:',
    'location.addEdit.location': 'Location:',
    'location.addEdit.help': 'Locations can be entered using many formats and are converted automatically.',
    'location.explainAsk':
        'To use the GPS, the geolocation permission is required.',
    'location.field.ACCURACY': 'Accuracy:',
    'location.field.ALTITUDE': 'Altitude:',
    'location.field.ALTITUDE_ACCURACY': 'Altitude Accuracy:',
    'location.field.HEADING': 'Heading:',
    'location.field.SPEED': 'Speed:',
    'location.field.unknownValue': 'Unknown',
    'location.coordinates.empty': 'No coordinates available.',
    'location.coordinates.mgrs': 'MGRS:',
    'location.coordinates.utmups': 'UTM/UPS:',
    'location.unavailable': 'Not Available',
    'location.unavailableMessage':
        'There is no GPS available on this device. The location tool will be removed from the starting menu.',
    'location.waypoints.location': 'Location',
    'location.waypoints.name': 'Name',
    'location.waypoints.noWaypoints': 'No waypoints have been saved.',
    'location.waypoints.unknownLocation': 'Unknown',

    // Magnifier
    'magnifier.explainAsk':
        'The magnifier requires the camera permission to function.',

    // Permission denied
    'permissionDenied.heading': 'Permission Denied',
    'permissionDenied.message':
        'Because the necessary permission was denied, the button in the menu will be removed. If this was done by mistake, you will need to go load the site in a web browser and manually reset the permissions. It is not possible for this application to prompt you again.',

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

    // Update
    'update.message': 'Update Available!',
    'update.reload': 'Reload Now',
    'update.skip': 'Next Launch',
};
