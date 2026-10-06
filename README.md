# Be Prepared

A toolbox of 24 everyday tools in one small app: flashlight, compass, level, magnifier, timers, alarm clock, barcode reader, and more. It works completely offline, which makes it handy in the field and a good way to turn a spare phone into something useful.

**Use it at [be-prepared.github.io](https://be-prepared.github.io).**

![Home screen in light and dark mode](screenshots/index.png)

## Private by design

* Nothing uses the internet once the app is loaded. There are no accounts, ads, analytics, or trackers.
* Nothing you do leaves your device. Camera, microphone, and sensor data are processed on the spot and never recorded or sent anywhere.
* The only things saved are your own settings and data (waypoints, alarms, ruler calibration), in your browser's local storage.
* The code is open. Please feel free to audit it.

## Installing and updating

Be Prepared is a Progressive Web App (PWA). Open the site and use your browser's "Install" or "Add to Home Screen" option to get an app icon. It also runs fine in a browser tab.

It works best in **Chrome on Android** and **Safari on iOS**.

The app updates itself when you are online. When a new version has downloaded, a drawer at the bottom of the screen offers to reload. To be sure you have the latest version: open the app while online, wait a minute, close it, then open it again.

## The tools

What each tool needs is listed after the description. Tools are only hidden from the home screen when your device doesn't have the hardware.

### Light and signaling

| Tool | What it does |
| --- | --- |
| **Flashlight** | Turns on the camera's light and keeps the screen awake. *Camera.* |
| **Front Light** | Turns the whole screen white, for phones without a camera light. |
| **Alarm** | Strobe the flashlight, sound a siren, and flash the screen, in any combination. Screen flashing stays under 3 flashes per second (a photosensitivity guideline). |
| **Magnifier** | Camera view starting at full zoom, plus up to 8× digital zoom on top. Pinch or use the zoom buttons, freeze the image, and toggle the light. *Camera.* |
| **Mirror** | Front camera, flipped like a real mirror, with digital zoom, freeze, and a white "light ring" border for dark rooms. *Camera.* |

### Getting around

| Tool | What it does |
| --- | --- |
| **Compass** | Works flat, upright, and in landscape. Warns when the compass needs calibration and when Low Power Mode is stopping the sensors. *Compass sensor.* |
| **Location** | Your coordinates in DMS, DDM, DDD, UTM/UPS, or MGRS; saved waypoints; navigation to a waypoint; and averaging many readings for an accurate position. Fields are configurable (see [Location fields](#location-fields)). *GPS.* |
| **Pedometer** | Distance traveled by GPS with start, pause, and reset, pace, and an estimated step count from your stride length. Filters out GPS jitter so standing still doesn't add distance. *GPS.* |
| **Speed** | Current, average, and maximum speed in mph or km/h. *GPS.* |
| **Sun & Moon** | Sunrise, sunset, twilight, moonrise, moonset, positions, and moon phase for any place and date. Find places by coordinates or the name of a major city. |

### Measuring

| Tool | What it does |
| --- | --- |
| **Level** | *Surface* mode is a bullseye for a phone lying flat. *Bars* mode works like a construction level, with one vial across the screen and one along it. Readings to one decimal, and each mode can be zeroed to cancel out a phone case. *Motion sensor.* |
| **Picture Hanging** | Camera view with a full-screen "+" and a second "+" aligned with the real horizon, plus how far off level you are left/right and toward/away from the wall. *Camera and motion sensor.* |
| **Protractor** | Drag two rays to measure an angle, over the camera view or a plain background. |
| **Ruler** | Centimeters and inches along the screen edges. Calibrate once with any credit or ID card for accurate measurements. |
| **Sound Level** | Approximate sound level in dB(A) with minimum, average, and maximum, and the matching category (quiet room, conversation, traffic, and so on). *Microphone.* |
| **Heart Rate** | Place a fingertip over the rear camera and its light; the camera detects your pulse from tiny color changes. Not a medical device. *Camera, works best with a flashlight.* |
| **Metal Detector** | Shows changes in the magnetic field, which finds iron, steel, and magnets. *Magnetometer, only available in Chrome with experimental sensor features turned on.* |

### Time

| Tool | What it does |
| --- | --- |
| **Alarm Clock** | One-time or repeating alarms with labels and snooze, plus a dim Nightstand mode. See the [limits](#limits-to-know-about). |
| **Timer** | Countdown with presets. It rings no matter which tool is open. |
| **Stopwatch** | Start, stop, and laps, with the fastest and slowest laps highlighted. |

### Information

| Tool | What it does |
| --- | --- |
| **Read Barcodes** | Reads the 1D and 2D barcodes your device supports, falling back to a built-in reader when the browser has none. Links are tappable. *Camera.* |
| **NFC** | Reads NFC tags and shows what's on them. *NFC, Chrome on Android.* |
| **File Transfer** | Send a file from one device to another with a stream of QR codes, no network needed. See [File Transfer](#file-transfer). *Camera to receive.* |
| **Large Text** | Shows a message as large as the screen allows, readable from a distance. |
| **Info** | Share the app, see which hardware and permissions are available, change preferences (coordinates, units, 12/24-hour time), and view build details. |

## Permissions

* Each tool asks for a permission only when you open it, and explains why first.
* Nothing about permissions is remembered by the app. If you deny one, the tool stays on the home screen, explains how to allow it again in your browser's settings, and offers a "Try Again" button.
* The camera and microphone are only on while their tool is open. They turn off when you leave the tool or switch away from the app.

## Limits to know about

A web app can do a lot, but not everything a native app can. Be Prepared tries to be upfront about this in the app itself.

* **Alarms and timers only ring while the app is open with the screen on.** A web app can't wake a sleeping phone or make sound in the background. Sound follows your media volume and can't get past silent mode or Do Not Disturb. For overnight use, open the Alarm Clock's Nightstand mode, plug the phone in, and turn the media volume up. Don't rely on it as your only wake-up alarm. If an alarm comes due while the app is closed, it's shown as missed the next time you open it.
* **Sensor readings are only as good as the phone.** Compass accuracy depends on calibration and nearby metal. The level can resolve a few tenths of a degree. Sound levels are estimates, since phone microphones aren't calibrated. The ruler is approximate until you calibrate it with a card.
* **Some features depend on the browser.** iOS doesn't let web apps control the camera's zoom or light, so the magnifier uses digital zoom there and the heart rate monitor may not work. NFC needs Chrome on Android. The metal detector needs an experimental Chrome setting.

## Tool details

### Location fields

The Location tool can show many different fields; tap a field to change it. Fields marked "navigation only" are available while navigating to a waypoint and reset when you leave that screen.

* **Accuracy:** How far off the GPS position could be. Whoever gave you coordinates could also have been off a bit, so expect to be close to the spot rather than exactly on it.
* **Altitude** and **Altitude Accuracy:** Height above sea level, and how accurate it is. Accuracy is often not available.
* **Arrival Time** (navigation only): When you're expected to arrive.
* **Bearing** (navigation only): The direction to the waypoint.
* **Current Time:** In 12-hour or 24-hour format.
* **Destination** (navigation only): The waypoint's name.
* **Distance** (navigation only): How far away the waypoint is.
* **Distance Traveled:** How far you've moved while the GPS was on.
* **Heading:** Your direction of travel as reported by the GPS, or calculated when it isn't reported.
* **Heading (Smoothed):** Direction of travel over the last five readings, using a [Kalman filter] that accounts for GPS accuracy to remove jumps and spikes.
* **Speed:** As reported by the GPS, or calculated when it isn't reported.
* **Speed (Smoothed):** An exponential moving average of the last five speeds, which removes spikes and dips.
* **Time Elapsed** (navigation only): How long you've been navigating.
* **Time Moving** and **Time Stopped:** Time spent at or above 0.35 m/s (just under 0.8 mph), and below it. These accumulate while you're on any Location screen and reset if you leave for more than a few seconds.
* **Time Remaining** (navigation only): How much longer until you arrive.

**Averaging a location:** Location averaging takes a weighted average of the readings in Earth-centered (ECEF) coordinates, then reports the distance that contains 95% of them. Because of atmospheric changes, it's best to collect readings for at least an hour. Each averaging session starts fresh.

### File Transfer

* The sender shows an endless stream of QR codes made with [Luby transform codes](https://en.wikipedia.org/wiki/Luby_transform_code). The receiver doesn't need every code, just enough of them, so missed frames don't matter.
* While receiving, a status like "2/1700 (+ 104) @ 7.98 FPS" means 2 of 1,700 blocks are decoded, and 104 more captured frames will help decode more blocks as pieces arrive. Frame rates are approximate.
* Compatible with [QRS](https://github.com/qifi-dev/qrs#readme). Be Prepared limits each frame to 16 blocks and uses a different distribution, so transfers finish about 30% faster on average.

### Major cities

Sun & Moon can look up about 10,000 of the world's largest cities by name. Use just the city name ("Minneapolis", not "Minneapolis, MN"). The list starts with every city of 15,000 people or more, keeps the most populated city when names repeat, then keeps the largest 10,000. Coordinates are packed with a base-92-style encoding to keep the app small.

## For developers

### Getting started

```bash
git clone https://github.com/fidian/be-prepared.git
cd be-prepared
npm install
npm start
```

The dev server runs at `http://localhost:8080/` and is reachable from other devices on your network at your computer's IP address, which is shown when it starts.

| Command | What it does |
| --- | --- |
| `npm start` | Development server with live reload. |
| `npm test` | Unit tests ([AVA](https://github.com/avajs/ava)). Tests live next to the code as `*.test.ts`. |
| `npm run build` | Type checks and builds the site into `dist/`. |
| `npm run generate-pwa-assets` | Regenerates the launcher icons from `site/public/app-icon.svg`. |
| `npm run tunnel` | Shares your dev server over HTTPS on the internet (see below). |

Pushing to `master` runs the tests, builds, and deploys to GitHub Pages.

The app is written in TypeScript with [Fudgel](https://github.com/fidian/fudgel), an extremely lightweight web component library, plus RxJS, and built into a PWA with Vite. **[AGENTS.md](AGENTS.md) describes the project layout, conventions, and pitfalls** and is worth reading before making changes, whether you're a person or an AI agent.

### Testing on a phone

Most tools need a real phone, and browsers only allow cameras and sensors on secure (HTTPS) pages.

* **Remote tunnel (easiest):** Run `npm start` in one terminal and `npm run tunnel` in another. Open the generated URL and enter your *public IP address* as the password.
* **Android and Chrome:** Open `chrome://flags#unsafely-treat-insecure-origins-as-secure`, add your computer's address (for example `http://192.168.1.10:8080`), and enable the option. You can also connect a USB cable and use [remote debugging](https://developer.chrome.com/docs/devtools/remote-debugging).

    ![Chrome flags screenshot](chrome-flags.jpg)

* **iOS and Safari:** Use a remote tunnel, or a local debugger as described in [this article](https://www.closingtags.com/remote-debugging-web-apps-on-ios-from-linux/).

### Debugging on a phone

[Eruda](https://github.com/liriliri/eruda) is a developer console for mobile browsers. Turn it on by adding `?eruda` to the URL or by tapping the "Build Information" heading on the Info screen ten times. It turns off when you close and reopen the app, or after ten more taps. Turning it on or off reloads the page, and Eruda starts before the app so every message and error is captured. Eruda is loaded from a CDN, so it needs a network connection; it's a developer tool only.

### Contributing

Pull requests are welcome. Please keep to the intent of the app:

* Every tool works offline. No fetching resources from the network.
* No data leaves the device. `localStorage` is fine for settings; avoid other access to local files.
* Ask for permissions only when a tool is used, never cache permission results, and release hardware when it's not needed.
* Be honest in the UI about accuracy and platform limits.
* Keep animations and extras minimal to save battery and space.
* Add unit tests for logic, and check your screens in portrait, landscape, light mode, and dark mode.

**Icons** are SVG, drawn on a 24×24 grid with `stroke="currentColor"` so they follow the light or dark theme.

[Kalman filter]: https://en.wikipedia.org/wiki/Kalman_filter
