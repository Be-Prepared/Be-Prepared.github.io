import { html } from 'fudgel';
import type { LanguageData } from './language-data';

export const enUS: LanguageData = {
    // Application-related and global strings
    'app.title': 'Be Prepared',
    'app.currentPermissionStatus': 'Current permission status',

    // Barcode reader
    'barcodeReader.explainAsk':
        'To use the barcode reader, the camera permission is required.',
    'barcodeReader.NATIVE': 'Native',
    'barcodeReader.Z_BAR': 'ZBar',

    // Compass
    'compass.compassUnavailable.heading': 'No Compass',
    'compass.compassUnavailable.message':
        'This device does not have a compass or the compass direction is not able to be retrieved. The compass will be removed from the starting menu.',

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
    'info.barcodes': 'Barcode support:',
    'info.barcodesNotSupported': 'Barcodes are not supported on this device.',
    'info.buildInformationHeader': 'Build Information',
    'info.camera': 'Camera:',
    'info.compass': 'Compass:',
    'info.compass.ABSOLUTE_ORIENTATION_SENSOR': 'A',
    'info.compass.DEVICE_ORIENTATION': 'DO',
    'info.compass.DEVICE_ORIENTATION_ABSOLUTE': 'DOA',
    'info.coordinates': 'Coordinates:',
    'info.coordinates.DDD': 'Decimal Degrees',
    'info.coordinates.DDM': 'Degrees Decimal Minutes',
    'info.coordinates.DMS': 'Degrees Minutes Seconds',
    'info.coordinates.MGRS': 'MGRS',
    'info.coordinates.UTM/UPS': 'UTM/UPS',
    'info.distances': 'Distances:',
    'info.distances.IMPERIAL': 'Imperial',
    'info.distances.METRIC': 'Metric',
    'info.framework': 'the framework driving this app',
    'info.geolocation': 'Geolocation:',
    'info.latestChangesHeader': 'Latest Changes:',
    'info.permission.denied': '✖ Denied',
    'info.permission.error': 'Error',
    'info.permission.granted': '✔ Granted',
    'info.permission.prompt': 'Prompt',
    'info.permissionsAndFeaturesHeader': 'Permissions and Features:',
    'info.preferences': 'Preferences:',
    'info.preferences.reset': 'Reset Preferences',
    'info.preferences.resetComplete': 'Preferences Reset',
    'info.shareApp': 'Share This App:',
    'info.share.copied': 'Website Copied!',
    'info.share.copy': 'Copy URL',
    'info.sourceCode': 'source code, bug reports, and feature requests',
    'info.svgCompression': 'SVG compression',
    'info.timeSystem': 'Time System:',
    'info.timeSystem.12_HOUR': '12 Hour',
    'info.timeSystem.24_HOUR': '24 Hour',
    'info.time12Hour.AM': 'AM',
    'info.time12Hour.PM': 'PM',
    'info.torch': 'Torch:',
    'info.toolingHeader': 'Tooling:',
    'info.wakeLock': 'Wake Lock:',

    // Install
    'install.action': 'Install',
    'install.message': 'Install to Home Screen',

    // Location
    'location.add.gettingCurrentLocation': 'Getting current location...',
    'location.add.waypointName': 'Unnamed Waypoint {{id}}',
    'location.average.currentEstimate': 'Current estimate:',
    'location.average.acc': 'Accuracy:',
    'location.average.calculating': 'Calculating...',
    'location.average.heading': 'Averaging:',
    'location.average.help':
        'It is best to collect several hundred or thousand points to help ensure accurate results. The screen must stay on for the app to be able to access the GPS, so it is recommended to use dark mode, dim your screen, and use an external battery if needed.',
    'location.average.help2':
        'When saving the point, the app will compute a recursive least squares regression fit of the collected points. This is an intensive process that can take several seconds to complete. The ending point might not match the location shown on this screen.',
    'location.average.lat': 'Latitude:',
    'location.average.lon': 'Longitude:',
    'location.average.pointsCollected': 'Points collected:',
    'location.average.xDelta': 'X Delta:',
    'location.average.yDelta': 'Y Delta:',
    'location.coordinates.DDD': 'Decimal Degrees',
    'location.coordinates.DDM': 'Degrees Decimal Minutes',
    'location.coordinates.DMS': 'Degrees Minutes Seconds',
    'location.coordinates.empty': 'No coordinates available.',
    'location.coordinates.MGRS': 'MGRS',
    'location.coordinates.UTMUPS': 'UTM/UPS',
    'location.edit.average': 'Average',
    'location.edit.badLocation': 'Invalid location',
    'location.edit.delete': 'Delete',
    'location.edit.helpSave': 'Changes are saved automatically.',
    'location.edit.location': 'Location:',
    'location.edit.name': 'Waypoint Name:',
    'location.explainAsk':
        'To use the GPS, the geolocation permission is required.',
    'location.field.ACCURACY': 'Accuracy',
    'location.field.ALTITUDE_ACCURACY': 'Altitude Accuracy',
    'location.field.ALTITUDE_AVERAGE': 'Altitude Average',
    'location.field.ALTITUDE_MINIMUM': 'Altitude Minimum',
    'location.field.ALTITUDE_MAXIMUM': 'Altitude Maximum',
    'location.field.ALTITUDE': 'Altitude',
    'location.field.BEARING': 'Bearing',
    'location.field.DESTINATION': 'Name',
    'location.field.DISTANCE': 'Distance',
    'location.field.DISTANCE_TRAVELED': 'Distance Traveled',
    'location.field.HEADING': 'Heading',
    'location.field.HEADING_SMOOTHED': 'Heading (Smoothed)',
    'location.field.SPEED': 'Speed',
    'location.field.SPEED_SMOOTHED': 'Speed (Smoothed)',
    'location.field.TIME': 'Current Time',
    'location.field.TIME_ARRIVAL': 'Arrival Time',
    'location.field.TIME_ELAPSED': 'Time Elapsed',
    'location.field.TIME_MOVING': 'Time Moving',
    'location.field.TIME_REMAINING': 'Time Remaining',
    'location.field.TIME_STOPPED': 'Time Stopped',
    'location.field.UNKNOWN': 'Unknown',
    'location.field.unknownValue': 'Unknown',
    'location.help.html': html`
        <p>
            Locations may be entered using a variety of common formats.
            Capitalization does not matter, most symbols can be ignored, and
            often spaces can be skipped as well. The examples listed here are
            not comprehensive, but should be able to illustrate many
            possibilities.
        </p>
        <p>City names:</p>
        <ul>
            <li>Paris</li>
            <li>NEW YORK CITY</li>
            <li>los angeles</li>
        </ul>
        <p>Decimal degrees:</p>
        <ul>
            <li>N 40° 26' 118.432" W 79° 58' 18.110"</li>
            <li>40 26 118.432 N 79 58 18.110 W</li>
            <li>40 26 118.432 -79 58 18.110</li>
        </ul>
        <p>Degrees decimal minutes:</p>
        <ul>
            <li>N 40° 26.123' W 79° 58.301'</li>
            <li>40 26.123 N 79 58.301 W</li>
            <li>40 26.123 -79 58.301</li>
        </ul>
        <p>Degrees minutes seconds:</p>
        <ul>
            <li>N 40° 26' 07.443" W 79° 58' 18.671"</li>
            <li>40 26 7.443 N 79 58 18.671 W</li>
            <li>40 26 7.443 -79 58 18.671</li>
        </ul>
        <p>MGRS:</p>
        <ul>
            <li>21K TQ 16525 52329</li>
            <li>18SUJ2337106519</li>
            <li>25X EN 21872 89264</li>
        </ul>
        <p>UTM/UPS:</p>
        <ul>
            <li>17 T 582561mE 4478883mN</li>
            <li>17T 582561 4478883</li>
            <li>17T E 582561 N 4478883</li>
            <li>17T582561 4478883</li>
            <li>B 2226827 2818270</li>
            <li>25x 521873 9289265</li>
        </ul>
    `,
    'location.navigation.COMPASS': 'Compass',
    'location.navigation.DIRECTION_OF_TRAVEL': 'Direction of Travel',
    'location.navigation.NORTH_UP': 'North Up',
    'location.navigation.unknownValue': 'Unknown',
    'location.positionDenied':
        'Permission denied. This may have been denied by the operating system even though it was granted by the user.',
    'location.positionError': 'There was an error retrieving the location.',
    'location.positionUnavailable': 'Position unavailable.',
    'location.retrievingLocation': 'Retrieving location...',
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

    // NFC
    'nfc.explainAsk': 'To use NFC, your permission is required.',
    'nfc.readNumber': 'Read number:',
    'nfc.record.encoding': 'Encoding:',
    'nfc.record.id': 'ID:',
    'nfc.record.lang': 'Language:',
    'nfc.record.mediaType': 'Media type:',
    'nfc.record.recordType': 'Record type:',
    'nfc.scanResult.initializeError': 'Error initializing NFC',
    'nfc.scanResult.numberOfRecords': 'Number of records:',
    'nfc.scanResult.readError': 'Error reading NFC tag',
    'nfc.scanResult.scanning': 'Scanning for NFC tags...',
    'nfc.scanResult.serialNumber': 'Serial number:',
    'nfc.scanResult.timestamp': 'Timestamp:',

    // Shared components
    'shared.cameraUnavailable.heading': 'No Suitable Camera',
    'shared.cameraUnavailable.message':
        'There is no camera available that this app can use for the selected tool. This tool will be removed from the starting menu.',
    'shared.permissionDenied.heading': 'Denied or Unavailable',
    'shared.permissionDenied.message':
        'Because the necessary permission was denied or the hardware is unavailable, the button in the menu will be removed.',
    'shared.permissionError.heading': 'Error',
    'shared.permissionError.message':
        'There was an error obtaining the necessary permission or information. Perhaps the device is already in use. This may be temporary.',
    'shared.permissionPrompt.goBack': 'Not Right Now',
    'shared.permissionPrompt.grantPermission': 'Grant Permission',
    'shared.permissionPrompt.heading': 'Permission Required',
    'shared.prettyInput.close': 'Close Help',

    // Services
    'service.torch.deviceIssue': 'Flashlight issue - reload required',
    'service.wakeLock.released': 'Letting Screen Turn Off',
    'service.wakeLock.obtained': 'Keeping Screen On',

    // Sun & Moon
    'sunMoon.enterCoordinates': 'Enter location:',
    'sunMoon.geolocation': 'Getting current location...',
    'sunMoon.geolocationError': 'Error getting current position',
    'sunMoon.locationUnknown': 'Location needed',
    'sunMoon.nearestMajorCity.label': 'Nearest major city:',
    'sunMoon.moonIllumination.firstQuarter': 'First quarter',
    'sunMoon.moonIllumination.fullMoon': 'Full moon',
    'sunMoon.moonIllumination.label': 'Moon phase:',
    'sunMoon.moonIllumination.lastQuarter': 'Last quarter',
    'sunMoon.moonIllumination.newMoon': 'New moon',
    'sunMoon.moonIllumination.waningCrescent': 'Waning crescent',
    'sunMoon.moonIllumination.waningGibbous': 'Waning gibbous',
    'sunMoon.moonIllumination.waxingCrescent': 'Waxing crescent',
    'sunMoon.moonIllumination.waxingGibbous': 'Waxing gibbous',
    'sunMoon.moonPosition.label': 'Moon position:',
    'sunMoon.moonTimes.alwaysDown': 'Moon does not rise today',
    'sunMoon.moonTimes.alwaysUp': 'Moon does not set today',
    'sunMoon.moonTimes.neverRise': 'Moon does not rise today',
    'sunMoon.moonTimes.neverSet': 'Moon does not set today',
    'sunMoon.moonTimes.rise': 'Moon rise:',
    'sunMoon.moonTimes.set': 'Moon set:',
    'sunMoon.sunPosition.label': 'Sun position:',
    'sunMoon.sunTimes.dawn': 'Dawn:',
    'sunMoon.sunTimes.dusk': 'Dusk:',
    'sunMoon.sunTimes.goldenHourEnd': 'Golden hour end:',
    'sunMoon.sunTimes.goldenHour': 'Golden hour start:',
    'sunMoon.sunTimes.nadir': 'Nadir (sun is lowest):',
    'sunMoon.sunTimes.nauticalDawn': 'Nautical dawn:',
    'sunMoon.sunTimes.nauticalDusk': 'Nautical dusk:',
    'sunMoon.sunTimes.nightEnd': 'Night end:',
    'sunMoon.sunTimes.night': 'Night:',
    'sunMoon.sunTimes.solarNoon': 'Solar noon:',
    'sunMoon.sunTimes.sunriseEnd': 'Sunrise end:',
    'sunMoon.sunTimes.sunrise': 'Sunrise:',
    'sunMoon.sunTimes.sunsetStart': 'Sunset start:',
    'sunMoon.sunTimes.sunset': 'Sunset:',

    // Tile labels on index
    'tile.barcodeReader': 'Read Barcodes',
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
    'tile.ruler': 'Ruler',
    'tile.speed': 'Speed',
    'tile.stopwatch': 'Stopwatch',
    'tile.sunMoon': 'Sun & Moon',
    'tile.temperature': 'Temperature',
    'tile.timer': 'Timer',

    // Update
    'update.message': 'Update Available!',
    'update.reload': 'Reload Now',
    'update.skip': 'Next Launch',
};
