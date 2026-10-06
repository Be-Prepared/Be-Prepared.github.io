// Works out which browser and platform the app runs in, and whether that's
// the one this app works best with (Chrome on Android, Safari on iOS).
//
// Browser detection is unreliable: Brave and Vivaldi send Chrome's user
// agent, and every iOS browser is WebKit underneath. So this only says "not
// recommended" when there is positive evidence (a browser's own token, its
// own brand, navigator.brave). When it can't tell, it says so and the app
// shows nothing.
//
// Pure: takes values read from navigator so it can be tested.

export enum BrowserPlatform {
    ANDROID = 'ANDROID',
    IOS = 'IOS',
    OTHER = 'OTHER',
}

export enum BrowserName {
    BRAVE = 'BRAVE',
    CHROME = 'CHROME',
    CHROMIUM = 'CHROMIUM',
    DUCKDUCKGO = 'DUCKDUCKGO',
    EDGE = 'EDGE',
    FIREFOX = 'FIREFOX',
    GOOGLE_APP = 'GOOGLE_APP',
    HOME_SCREEN = 'HOME_SCREEN',
    IN_APP = 'IN_APP',
    OPERA = 'OPERA',
    // Identified as some other browser, but not one listed here.
    OTHER = 'OTHER',
    SAFARI = 'SAFARI',
    SAMSUNG = 'SAMSUNG',
    UC = 'UC',
    UNKNOWN = 'UNKNOWN',
    WEBVIEW = 'WEBVIEW',
    YANDEX = 'YANDEX',
}

export enum BrowserStatus {
    // Positive evidence it's the recommended browser (Chrome's own brand).
    RECOMMENDED = 'RECOMMENDED',
    // Looks like it, but other browsers can look the same.
    PROBABLY_RECOMMENDED = 'PROBABLY_RECOMMENDED',
    // Positive evidence it's a different browser.
    NOT_RECOMMENDED = 'NOT_RECOMMENDED',
    // Can't tell, or not a phone.
    UNKNOWN = 'UNKNOWN',
}

export interface BrowserBrand {
    brand: string;
    version?: string;
}

export interface BrowserInputs {
    userAgent: string;
    // navigator.userAgentData.brands (Chromium only, secure contexts only).
    brands?: readonly BrowserBrand[] | null;
    // navigator.userAgentData.platform, or navigator.platform.
    platform?: string | null;
    // navigator.maxTouchPoints; iPads ask for desktop sites and claim to be
    // a Mac.
    maxTouchPoints?: number | null;
    // navigator.brave exists.
    isBrave?: boolean;
    // Running from the Home Screen (navigator.standalone or display-mode).
    standalone?: boolean;
}

export interface BrowserDetection {
    browser: BrowserName;
    platform: BrowserPlatform;
    recommended: BrowserName | null;
    showNotice: boolean;
    status: BrowserStatus;
}

export function detectPlatform(inputs: BrowserInputs): BrowserPlatform {
    const ua = inputs.userAgent || '';
    const platform = (inputs.platform || '').toLowerCase();

    if (/android/i.test(ua) || platform === 'android') {
        return BrowserPlatform.ANDROID;
    }

    if (
        /iPhone|iPad|iPod/.test(ua) ||
        /^(iphone|ipad|ipod|ios)/.test(platform)
    ) {
        return BrowserPlatform.IOS;
    }

    // iPadOS requests desktop sites by default and reports itself as a Mac.
    // Macs don't have touch screens.
    if (/Macintosh/.test(ua) && (inputs.maxTouchPoints || 0) > 1) {
        return BrowserPlatform.IOS;
    }

    return BrowserPlatform.OTHER;
}

function hasBrand(brands: readonly BrowserBrand[], pattern: RegExp) {
    return brands.some((item) => pattern.test(item.brand || ''));
}

// Tokens that browsers add to their user agent. Order matters: more
// specific first.
const IOS_TOKENS: [RegExp, BrowserName][] = [
    [/\bBrave\b/, BrowserName.BRAVE],
    [/\bCriOS\//, BrowserName.CHROME],
    [/\bFxiOS\//, BrowserName.FIREFOX],
    [/\bEdgiOS\//, BrowserName.EDGE],
    [/\b(OPiOS|OPT)\//, BrowserName.OPERA],
    [/\b(DuckDuckGo|Ddg)\//, BrowserName.DUCKDUCKGO],
    [/\bYaBrowser\//, BrowserName.YANDEX],
    [/\bUCBrowser\//, BrowserName.UC],
    [/\bGSA\//, BrowserName.GOOGLE_APP],
    [
        /\b(FBAN|FBAV|FBIOS|Instagram|LinkedInApp|Line\/|Snapchat|Twitter|MicroMessenger|Pinterest)/,
        BrowserName.IN_APP,
    ],
];

const ANDROID_TOKENS: [RegExp, BrowserName][] = [
    [/\bSamsungBrowser\//, BrowserName.SAMSUNG],
    [/\bEdgA?\//, BrowserName.EDGE],
    [/\b(OPR|OPX|Opera)\//, BrowserName.OPERA],
    [/\bFirefox\//, BrowserName.FIREFOX],
    [/\b(DuckDuckGo|Ddg)\//, BrowserName.DUCKDUCKGO],
    [/\bYaBrowser\//, BrowserName.YANDEX],
    [/\bUCBrowser\//, BrowserName.UC],
    [/\bGSA\//, BrowserName.GOOGLE_APP],
    [
        /\b(FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Line\/|Snapchat|Twitter|MicroMessenger|Pinterest)/,
        BrowserName.IN_APP,
    ],
    [/; wv\)/, BrowserName.WEBVIEW],
    [
        /\b(MiuiBrowser|HuaweiBrowser|HeyTapBrowser|VivoBrowser|Silk|Puffin)\//,
        BrowserName.OTHER,
    ],
];

const ANDROID_BRANDS: [RegExp, BrowserName][] = [
    [/^Brave$/i, BrowserName.BRAVE],
    [/^Microsoft Edge$/i, BrowserName.EDGE],
    [/^Opera/i, BrowserName.OPERA],
    [/^Samsung Internet$/i, BrowserName.SAMSUNG],
    [/^YaBrowser$|^Yandex/i, BrowserName.YANDEX],
    [/^DuckDuckGo$/i, BrowserName.DUCKDUCKGO],
    [/^Android WebView$/i, BrowserName.WEBVIEW],
];

function findToken(ua: string, tokens: [RegExp, BrowserName][]) {
    const match = tokens.find(([pattern]) => pattern.test(ua));

    return match ? match[1] : null;
}

function result(
    platform: BrowserPlatform,
    browser: BrowserName,
    status: BrowserStatus
): BrowserDetection {
    const recommended =
        platform === BrowserPlatform.ANDROID
            ? BrowserName.CHROME
            : platform === BrowserPlatform.IOS
              ? BrowserName.SAFARI
              : null;

    return {
        browser,
        platform,
        recommended,
        showNotice:
            platform !== BrowserPlatform.OTHER &&
            status === BrowserStatus.NOT_RECOMMENDED,
        status,
    };
}

function detectIos(inputs: BrowserInputs): BrowserDetection {
    const ua = inputs.userAgent || '';
    const platform = BrowserPlatform.IOS;

    // Home Screen apps have no "Safari/" token, and only work this way when
    // installed, so whichever browser installed it did its job.
    if (inputs.standalone) {
        return result(
            platform,
            BrowserName.HOME_SCREEN,
            BrowserStatus.PROBABLY_RECOMMENDED
        );
    }

    if (inputs.isBrave) {
        return result(platform, BrowserName.BRAVE, BrowserStatus.NOT_RECOMMENDED);
    }

    const token = findToken(ua, IOS_TOKENS);

    if (token) {
        return result(platform, token, BrowserStatus.NOT_RECOMMENDED);
    }

    // Safari has both. Apps that show pages in their own web view usually
    // leave out "Safari/".
    if (/\bVersion\/[\d.]+/.test(ua) && /\bSafari\//.test(ua)) {
        // Some other browsers send exactly this, so it can't be certain.
        return result(
            platform,
            BrowserName.SAFARI,
            BrowserStatus.PROBABLY_RECOMMENDED
        );
    }

    if (/AppleWebKit\//.test(ua) && !/\bSafari\//.test(ua)) {
        return result(platform, BrowserName.IN_APP, BrowserStatus.NOT_RECOMMENDED);
    }

    return result(platform, BrowserName.UNKNOWN, BrowserStatus.UNKNOWN);
}

function detectAndroid(inputs: BrowserInputs): BrowserDetection {
    const ua = inputs.userAgent || '';
    const brands = inputs.brands || [];
    const platform = BrowserPlatform.ANDROID;

    if (inputs.isBrave || hasBrand(brands, /^Brave$/i)) {
        return result(platform, BrowserName.BRAVE, BrowserStatus.NOT_RECOMMENDED);
    }

    const token = findToken(ua, ANDROID_TOKENS);

    if (token) {
        return result(platform, token, BrowserStatus.NOT_RECOMMENDED);
    }

    if (brands.length) {
        const branded = brands
            .map((item) => findToken(item.brand || '', ANDROID_BRANDS))
            .find((name) => name);

        if (branded) {
            return result(platform, branded, BrowserStatus.NOT_RECOMMENDED);
        }

        if (hasBrand(brands, /^Google Chrome$/i)) {
            return result(
                platform,
                BrowserName.CHROME,
                BrowserStatus.RECOMMENDED
            );
        }

        // Chromium without Google's brand is another browser built on it,
        // like Vivaldi or Kiwi.
        if (hasBrand(brands, /^Chromium$/i)) {
            return result(
                platform,
                BrowserName.CHROMIUM,
                BrowserStatus.NOT_RECOMMENDED
            );
        }
    }

    if (/\bChrome\/[\d.]+/.test(ua)) {
        return result(
            platform,
            BrowserName.CHROME,
            BrowserStatus.PROBABLY_RECOMMENDED
        );
    }

    return result(platform, BrowserName.UNKNOWN, BrowserStatus.UNKNOWN);
}

export function detectBrowser(inputs: BrowserInputs): BrowserDetection {
    switch (detectPlatform(inputs)) {
        case BrowserPlatform.ANDROID:
            return detectAndroid(inputs);

        case BrowserPlatform.IOS:
            return detectIos(inputs);

        default:
            return result(
                BrowserPlatform.OTHER,
                BrowserName.UNKNOWN,
                BrowserStatus.UNKNOWN
            );
    }
}
