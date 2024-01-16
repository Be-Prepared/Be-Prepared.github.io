Work in progress - yet another toolbox filled with offline-only tools. Useful for your everyday life and can turn your backup phone into a useful device. Nothing uses the internet, accesses local files, or sends content to a remote server. I care about your privacy and security.

Use this application at [Be-Prepared.github.io](https://be-prepared.github.io). It's a PWA and is installable as an application with a tap. Because it's a PWA, it can only auto-update itself when you are online. This can happen in the background or when you launch the application. An easy way to ensure you have the latest version is to make sure you are on the internet and run the app, wait a minute, close the app, then open it again.

Also is an example of how to use [Fudgel](https://github.com/fidian/fudgel), an extremely lightweight web component library.

## What's included

* Flashlight
    * Simply turns on the camera's flashlight.
    * Uses the `camera` permission.
    * Sets the `torch` capability on a video track. If the capability is not there or the device doesn't report any video devices, the status moves to "unavailable".

* Front screen
    * Makes the screen white. Useful for devices without a flashlight on the camera.

* Magnifier
    * Uses the camera and starts it at maximum zoom.
    * Requires the `camera` permission.
    * Can turn on and off the camera's light, if one exists.

* Info
    * Shows permission statuses that the application could use.
    * Provides links to tools that are used to build the PWA.
    * Gives credit to the icon designers.

## For Developers

This project runs like most other typical Node.js projects. First clone or download the repository, then install packages, and finally serve content.

```bash
git clone https://github.com/fidian/be-prepared.git
cd be-prepared
npm install
npm run start
```

The server is started at `http://localhost:8080/` and is exposed to everyone on your network through your computer's IP address, which makes testing on mobile devices much easier. The IP address and port will be displayed when the server starts.

If you want to test all of the features on mobile devices, you will need to go to `chrome://flags` and look for "Insecure origins treated as secure" (you can get there directly with `chrome://flags#unsafely-treat-insecure-origins-as-secure`). Add your computer's URL to the exceptions box and change the option to Enabled. This is how it looks on my device; your IP address will likely be different.

![Chrome Flags Screenshot](chrome-flags.jpg)

Unfortunately, that will not be a valid workaround for iOS, so there's also `npm run https` to serve the content with HTTPS locally. It's a self-signed certificate that you will need to accept each time you visit the site, but it does the trick.

Also, debugging on mobile devices is difficult. If you add "?eruda" to the URL, it will load [Eruda](https://github.com/liriliri/eruda), a console for mobile browsers. It will be configured to fully initialize before the application starts, allowing all messages and errors to get logged appropriately. This is extremely useful.

Pull requests for additional functionality are welcome. Please make sure you maintain the intent of this code.

* Offline tools only
* No access to local files; using `localStorage` is acceptable
* No sending data off the application
* Animations and extra frills are limited to conserve battery and space
