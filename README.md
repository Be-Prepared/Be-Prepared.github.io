Work in progress - yet another toolbox filled with offline-only tools. Useful for your everyday life and can turn your backup phone into a useful device. None of the tools use the internet.

Use this application at [Be-Prepared.github.io](https://be-prepared.github.io). It's a PWA and is installable to your phone with a tap.

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
