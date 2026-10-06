import { html } from 'fudgel';
import type { LanguageData } from './language-data';
import { mirrorStrings } from '../mirror-app/mirror-app.i18n';
import { levelStrings } from '../level-app/level-app.i18n';
import { pictureHangingStrings } from '../picture-hanging-app/picture-hanging-app.i18n';
import { protractorStrings } from '../protractor-app/protractor-app.i18n';
import { soundLevelStrings } from '../sound-level-app/sound-level-app.i18n';
import { heartRateStrings } from '../heart-rate-app/heart-rate-app.i18n';
import { alarmStrings } from '../alarm-app/alarm-app.i18n';
import { alarmClockStrings } from '../alarm-clock-app/alarm-clock-app.i18n';
import { timerStrings } from '../timer-app/timer-app.i18n';
import { stopwatchStrings } from '../stopwatch-app/stopwatch-app.i18n';
import { pedometerStrings } from '../pedometer-app/pedometer-app.i18n';
import { rulerStrings } from '../ruler-app/ruler-app.i18n';
import { metalDetectorStrings } from '../metal-detector-app/metal-detector-app.i18n';

export const enUS: LanguageData = {
    // Strings kept next to each tool
    ...alarmStrings,
    ...alarmClockStrings,
    ...heartRateStrings,
    ...levelStrings,
    ...metalDetectorStrings,
    ...mirrorStrings,
    ...pedometerStrings,
    ...pictureHangingStrings,
    ...protractorStrings,
    ...rulerStrings,
    ...soundLevelStrings,
    ...stopwatchStrings,
    ...timerStrings,

    // Application-related and global strings
    'app.title': 'Be Prepared',

    // Barcode reader
    'barcodeReader.explainAsk':
        'To use the barcode reader, the camera permission is required.',
    'barcodeReader.NATIVE': 'Native',
    'barcodeReader.Z_BAR': 'ZBar',
    'barcodeReader.scanAgain': 'Scan Again',

    // Compass
    'compass.calibrate':
        'The compass looks inaccurate. Move your phone in a slow figure 8, twisting it in every direction, away from metal and magnets.',
    'compass.explainAsk':
        'The compass needs access to motion and orientation sensors.',
    'compass.source.ABSOLUTE_ORIENTATION_SENSOR': 'Orientation sensor',
    'compass.source.DEVICE_ORIENTATION': 'Device orientation',
    'compass.source.DEVICE_ORIENTATION_ABSOLUTE':
        'Device orientation (absolute)',
    'compass.source.NONE': 'Waiting for sensor',
    'compass.source.WEBKIT_COMPASS_HEADING': 'iOS compass',
    'compass.unavailable':
        'This device has no compass, or the browser does not share its direction.',
    'compass.waiting':
        'No compass readings yet. If Low Power Mode or Battery Saver is on, turn it off; it can stop motion sensors from reporting.',

    // File Transfer
    'fileTransfer.send': 'Send',
    'fileTransfer.send.fps': 'FPS:',
    'fileTransfer.send.loading': 'Loading',
    'fileTransfer.send.selectFile': 'Select File',
    'fileTransfer.send.size': 'Size:',
    'fileTransfer.receive': 'Receive',
    'fileTransfer.receive.download': 'Download:',
    'fileTransfer.receive.explainAsk':
        'To use the barcode reader to receive a file, the camera permission is required.',
    'fileTransfer.receive.fps': 'FPS',

    // Flashlight
    'flashlight.explainAsk':
        'The flashlight is part of the camera, so the camera permission is needed to turn it on. No pictures are taken.',
    'flashlight.off': 'Off',
    'flashlight.on': 'On',
    'flashlight.unavailableMessage':
        'None of the cameras this app can use has a light it can control.',

    // Info
    'info.barcodes': 'Barcode support:',
    'info.barcodesNotSupported': 'Barcodes are not supported on this device.',
    'info.buildInformationHeader': 'Build Information',
    'info.camera': 'Camera:',
    'info.compass': 'Compass:',
    'info.contact.email': 'Email Developer',
    'info.contact.feedback':
        'To provide feedback, suggestions, and bug reports, you can go to the project site or email the developer directly.',
    'info.contact.issues': 'Report Bugs, Request Features',
    'info.contact.specificBrowsers':
        'Important: This app works best in Chrome on Android and Safari on iOS. There are permissions and installation issues with other browsers.',
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
    'info.hardware.no': 'Not found',
    'info.hardware.yes': 'Present',
    'info.latestChangesHeader': 'Latest Changes:',
    'info.nfc': 'NFC:',
    'info.permission.DENIED': 'Blocked',
    'info.permission.GRANTED': 'Allowed',
    'info.permission.PROMPT': 'Will ask',
    'info.permission.UNKNOWN': 'Asks when used',
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
    'info.toolingHeader': 'Tooling:',
    'info.wakeLock': 'Wake Lock:',

    // Install
    'install.action': 'Install',
    'install.message': 'Install to Home Screen',

    // Large Text
    'largeText.placeholder': 'Type Here',

    // Location
    'location.add.gettingCurrentLocation': 'Getting current location...',
    'location.add.waypointName': 'Unnamed Waypoint {{id}}',
    'location.addWaypoint': 'Add waypoint',
    'location.average.currentEstimate': 'Current estimate:',
    'location.average.calculating': 'Calculating...',
    'location.average.heading': 'Averaging:',
    'location.average.help':
        'It is best to collect points for over an hour to improve accuracy. Points will collect at 1 point per second, so 3,600 per hour. The screen must stay on for the app to be able to access the GPS, so it is recommended to use dark mode, dim your screen, and use an external battery if needed.',
    'location.average.help2':
        'The distance to 95% of the collected points is shown. The value is essentially meaningless with fewer than a few hundred points. After collecting a thousand points, the value here shows how well clustered the points are.',
    'location.average.lat': 'Latitude:',
    'location.average.lon': 'Longitude:',
    'location.average.ninetyFive': '95% Distance:',
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
    'location.field.SPEED_AVERAGE': 'Speed (Average)',
    'location.field.SPEED_MAXIMUM': 'Speed (Max)',
    'location.field.SPEED_SMOOTHED': 'Speed (Smoothed)',
    'location.field.SPEED_SMOOTHED_MAXIMUM': 'Speed (Smoothed, Max)',
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
    'location.keepScreenOn': 'Keep screen on',
    'location.navigate': 'Navigate',
    'location.navigation.COMPASS': 'Compass',
    'location.navigation.DIRECTION_OF_TRAVEL': 'Direction of Travel',
    'location.navigation.NORTH_UP': 'North Up',
    'location.navigation.unknownValue': 'Unknown',
    'location.positionDenied':
        'Permission denied. This may have been denied by the operating system even though it was granted by the user.',
    'location.positionError': 'There was an error retrieving the location.',
    'location.positionUnavailable': 'Position unavailable.',
    'location.retrievingLocation': 'Retrieving location...',
    'location.save': 'Save',
    'location.unavailableMessage':
        'There is no location service available on this device.',
    'location.waypointList': 'Waypoints',
    'location.waypoints.location': 'Location',
    'location.waypoints.name': 'Name',
    'location.waypoints.noWaypoints': 'No waypoints have been saved.',
    'location.waypoints.unknownLocation': 'Unknown',

    // Magnifier
    'magnifier.explainAsk':
        'The magnifier shows the camera\'s view, zoomed in. It needs the camera permission. Nothing is recorded.',
    'magnifier.freeze': 'Freeze image',
    'magnifier.resume': 'Resume',
    'magnifier.zoomIn': 'Zoom in',
    'magnifier.zoomOut': 'Zoom out',

    // NFC
    'nfc.error':
        'NFC could not start. Make sure NFC is turned on in your phone\'s settings, then try again.',
    'nfc.explainAsk': 'To use NFC, your permission is required.',
    'nfc.readNumber': 'Read number:',
    'nfc.record.encoding': 'Encoding:',
    'nfc.record.id': 'ID:',
    'nfc.record.lang': 'Language:',
    'nfc.record.mediaType': 'Media type:',
    'nfc.record.recordType': 'Record type:',
    'nfc.scanResult.numberOfRecords': 'Number of records:',
    'nfc.scanResult.readError': 'Error reading NFC tag',
    'nfc.scanResult.scanning': 'Scanning for NFC tags...',
    'nfc.scanResult.serialNumber': 'Serial number:',
    'nfc.scanResult.timestamp': 'Timestamp:',
    'nfc.unavailable.message':
        'This browser or device does not support reading NFC tags.',

    // Timer and alarm clock alert, shown over any screen
    'ringer.alarm': 'Alarm',
    'ringer.alarmHeading': 'Alarm',
    'ringer.dismiss': 'Dismiss',
    'ringer.missed': 'missed',
    'ringer.missedExplain':
        "Be Prepared was closed or the phone was asleep at the time, so it couldn't ring. Web apps can only make sound while they're open.",
    'ringer.missedHeading': 'Missed While Closed',
    'ringer.restartTimer': 'Restart Timer',
    'ringer.snooze': 'Snooze 9 Minutes',
    'ringer.timer': 'Timer',
    'ringer.timerDone': 'Time\'s Up!',

    // Limits of timers and alarms in a web app. Shown wherever someone might
    // count on a sound later.
    'reminderLimits.heading': 'Know the limits',
    'reminderLimits.full.html': html`
        <ul style="margin: 0; padding-left: 1.1em">
            <li>
                Alarms only ring while Be Prepared is open and the screen is
                on. If you close the app, switch to another app, or the screen
                turns off, it can't make a sound.
            </li>
            <li>
                Web apps can't wake a sleeping phone or ring in the
                background. Your phone may also put the app to sleep on its
                own.
            </li>
            <li>
                The sound uses your media volume. Silent mode, Do Not Disturb,
                or a low media volume can keep you from hearing it.
            </li>
            <li>
                Don't rely on this as your only wake-up alarm. Your phone's
                built-in clock app can ring when the phone is asleep.
            </li>
            <li>
                For overnight use, open Nightstand mode, plug the phone in,
                and turn the media volume up.
            </li>
        </ul>
    `,
    'reminderLimits.editor':
        "This alarm only rings if Be Prepared is open with the screen on when it's due. It can't wake a sleeping phone.",
    'reminderLimits.nightstand':
        'Keep this screen open, the phone plugged in, and the media volume up. Alarms cannot ring if the app is closed or the phone sleeps.',
    'reminderLimits.timer':
        "Keep Be Prepared open with the screen on until the timer ends. It can't ring if the app is closed, you switch apps, or the phone sleeps. Sound follows the media volume.",

    // Shared components
    'shared.access.allow': 'Allow',
    'shared.access.back': 'Back',
    'shared.access.denied.heading': 'Permission Blocked',
    'shared.access.denied.message':
        'This tool can\'t work without the permission. Nothing is remembered by this app, so you can try again at any time.',
    'shared.access.deniedHint.android':
        'If "Try Again" does nothing, the browser is blocking it. In Chrome, tap the icon to the left of the address (or open the installed app\'s info page), choose Permissions, and allow it. Then come back here.',
    'shared.access.deniedHint.ios':
        'If "Try Again" does nothing, iOS is blocking it. Open Settings → Apps → Safari (or Settings → Safari) and allow Camera, Location, or Motion & Orientation access. For motion and compass access, fully close and reopen the app as well.',
    'shared.access.deniedHint.other':
        'If "Try Again" does nothing, the browser is blocking it. Open the site settings (usually the icon next to the address) and allow the permission, then come back here.',
    'shared.access.error.heading': 'Couldn\'t Start',
    'shared.access.error.message':
        'The hardware is there but could not be started. Another app may be using it. Close other apps that use it and try again.',
    'shared.access.prompt.heading': 'Permission Needed',
    'shared.access.prompt.hint':
        'Your browser will ask next. Everything stays on this device.',
    'shared.access.tryAgain': 'Try Again',
    'shared.access.unavailable.heading': 'Not Available',
    'shared.access.unavailable.message':
        'This device doesn\'t have the hardware this tool needs.',
    'shared.prettyInput.close': 'Close Help',
    'shared.torch': 'Light',

    // Speed
    'speed.average': 'Average:',
    'speed.maximum': 'Maximum:',

    // Services
    'service.wakeLock.released': 'Letting Screen Turn Off',
    'service.wakeLock.obtained': 'Keeping Screen On',

    // Sun & Moon
    'sunMoon.enterCoordinates': 'Enter location:',
    'sunMoon.enterDate': 'Enter date and time:',
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
    'sunMoon.sunTimes.neverRise': 'Sun does not rise today',
    'sunMoon.sunTimes.neverSet': 'Sun does not set today',
    'sunMoon.sunTimes.nightEnd': 'Night end:',
    'sunMoon.sunTimes.night': 'Night:',
    'sunMoon.sunTimes.solarNoon': 'Solar noon:',
    'sunMoon.sunTimes.sunriseEnd': 'Sunrise end:',
    'sunMoon.sunTimes.sunrise': 'Sunrise:',
    'sunMoon.sunTimes.sunsetStart': 'Sunset start:',
    'sunMoon.sunTimes.sunset': 'Sunset:',

    // Tile labels on index
    'tile.alarm': 'Alarm',
    'tile.alarmClock': 'Alarm Clock',
    'tile.barcodeReader': 'Read Barcodes',
    'tile.compass': 'Compass',
    'tile.fileTransfer': 'File Transfer',
    'tile.flashlight': 'Flashlight',
    'tile.frontLight': 'Front Light',
    'tile.heartRate': 'Heart Rate',
    'tile.info': 'Info',
    'tile.largeText': 'Large Text',
    'tile.level': 'Level',
    'tile.location': 'Location',
    'tile.magnifier': 'Magnifier',
    'tile.metalDetector': 'Metal Detector',
    'tile.mirror': 'Mirror',
    'tile.nfc': 'NFC',
    'tile.pedometer': 'Pedometer',
    'tile.pictureHanging': 'Picture Hanging',
    'tile.protractor': 'Protractor',
    'tile.ruler': 'Ruler',
    'tile.soundLevel': 'Sound Level',
    'tile.speed': 'Speed',
    'tile.stopwatch': 'Stopwatch',
    'tile.sunMoon': 'Sun & Moon',
    'tile.timer': 'Timer',

    // Update
    'update.message': 'Update Available!',
    'update.reload': 'Reload Now',
    'update.skip': 'Next Launch',
};
