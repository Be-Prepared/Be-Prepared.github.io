import {
    BrowserBrand,
    BrowserInputs,
    BrowserName,
    BrowserPlatform,
    BrowserStatus,
    detectBrowser,
    detectPlatform,
} from './browser-detect';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// Real-world user agent strings.
const UA = {
    androidChrome:
        'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
    androidChromeOld:
        'Mozilla/5.0 (Linux; Android 9; SM-G960F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.157 Mobile Safari/537.36',
    androidSamsung:
        'Mozilla/5.0 (Linux; Android 10; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
    androidFirefox:
        'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0',
    androidEdge:
        'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36 EdgA/129.0.2792.84',
    androidOpera:
        'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36 OPR/85.0.0.0',
    androidDuckDuckGo:
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile DuckDuckGo/5 Safari/537.36',
    androidYandex:
        'Mozilla/5.0 (Linux; arm_64; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 YaBrowser/24.4.5.98.00 SA/3 Mobile Safari/537.36',
    androidUc:
        'Mozilla/5.0 (Linux; U; Android 11; en-US; RMX2193 Build/RP1A.200720.011) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.58 UCBrowser/13.4.0.1306 Mobile Safari/537.36',
    androidWebView:
        'Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230805.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36',
    androidFacebook:
        'Mozilla/5.0 (Linux; Android 13; SM-G991U Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/118.0.5993.111 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/439.0.0.29.119;]',
    androidMiui:
        'Mozilla/5.0 (Linux; U; Android 12; en-us; 2201117TG Build/SKQ1.211006.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/112.0.5615.136 Mobile Safari/537.36 XiaoMi/MiuiBrowser/14.4.0-g',
    // Brave and Vivaldi send exactly Chrome's user agent.
    androidBrave:
        'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
    iosSafari:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
    iosChrome:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1',
    iosFirefox:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/131.0 Mobile/15E148 Safari/605.1.15',
    iosEdge:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/129.0.2792.84 Mobile/15E148 Safari/605.1.15',
    iosOpera:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 OPT/5.0.2',
    iosDuckDuckGo:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1 Ddg/17.6',
    iosGoogleApp:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/333.0.680713498 Mobile/15E148 Safari/604.1',
    iosFacebook:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/482.0.0.37.106;FBBV/656617781;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.6;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5;FBRV/658464389]',
    iosInstagram:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.21.106 (iPhone14,5; iOS 17_6; en_US; en; scale=3.00; 1170x2532; 643286367)',
    // Web view in some app that adds nothing of its own. Also what a Home
    // Screen app looks like.
    iosWebView:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    ipadDesktop:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
    ipadChrome:
        'Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1',
    macSafari:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
    windowsChrome:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    linuxFirefox:
        'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
};

const CHROME_BRANDS: BrowserBrand[] = [
    { brand: 'Google Chrome', version: '129' },
    { brand: 'Not=A?Brand', version: '8' },
    { brand: 'Chromium', version: '129' },
];

function detect(userAgent: string, extra: Partial<BrowserInputs> = {}) {
    return detectBrowser({ userAgent, ...extra });
}

function check(
    inputs: ReturnType<typeof detect>,
    platform: BrowserPlatform,
    browser: BrowserName,
    status: BrowserStatus
) {
    assert.equal(inputs.platform, platform, 'platform');
    assert.equal(inputs.browser, browser, 'browser');
    assert.equal(inputs.status, status, 'status');
    assert.equal(
        inputs.showNotice,
        status === BrowserStatus.NOT_RECOMMENDED,
        'showNotice'
    );
}

test('platform detection', () => {
    assert.equal(detectPlatform({ userAgent: UA.androidChrome }), BrowserPlatform.ANDROID);
    assert.equal(detectPlatform({ userAgent: UA.androidFirefox }), BrowserPlatform.ANDROID);
    assert.equal(detectPlatform({ userAgent: UA.iosSafari }), BrowserPlatform.IOS);
    assert.equal(detectPlatform({ userAgent: UA.ipadChrome }), BrowserPlatform.IOS);
    assert.equal(
        detectPlatform({ userAgent: UA.ipadDesktop, maxTouchPoints: 5 }),
        BrowserPlatform.IOS
    );
    assert.equal(
        detectPlatform({ userAgent: UA.macSafari, maxTouchPoints: 0 }),
        BrowserPlatform.OTHER
    );
    assert.equal(detectPlatform({ userAgent: UA.windowsChrome }), BrowserPlatform.OTHER);
    // A reduced user agent with the platform from userAgentData.
    assert.equal(
        detectPlatform({ userAgent: 'Mozilla/5.0', platform: 'Android' }),
        BrowserPlatform.ANDROID
    );
    assert.equal(
        detectPlatform({ userAgent: 'Mozilla/5.0', platform: 'iPhone' }),
        BrowserPlatform.IOS
    );
});

test('Android Chrome with its brand is recommended', () => {
    const result = detect(UA.androidChrome, {
        brands: CHROME_BRANDS,
        platform: 'Android',
    });
    check(result, BrowserPlatform.ANDROID, BrowserName.CHROME, BrowserStatus.RECOMMENDED);
    assert.equal(result.recommended, BrowserName.CHROME);
});

test('Android Chrome without brands is probably fine; no notice', () => {
    check(
        detect(UA.androidChromeOld),
        BrowserPlatform.ANDROID,
        BrowserName.CHROME,
        BrowserStatus.PROBABLY_RECOMMENDED
    );
});

test('Android browsers that name themselves', () => {
    const cases: [string, BrowserName][] = [
        [UA.androidSamsung, BrowserName.SAMSUNG],
        [UA.androidFirefox, BrowserName.FIREFOX],
        [UA.androidEdge, BrowserName.EDGE],
        [UA.androidOpera, BrowserName.OPERA],
        [UA.androidDuckDuckGo, BrowserName.DUCKDUCKGO],
        [UA.androidYandex, BrowserName.YANDEX],
        [UA.androidUc, BrowserName.UC],
        [UA.androidWebView, BrowserName.WEBVIEW],
        [UA.androidFacebook, BrowserName.IN_APP],
        [UA.androidMiui, BrowserName.OTHER],
    ];

    for (const [userAgent, browser] of cases) {
        check(
            detect(userAgent),
            BrowserPlatform.ANDROID,
            browser,
            BrowserStatus.NOT_RECOMMENDED
        );
    }
});

test('Brave on Android is found by navigator.brave or its brand', () => {
    check(
        detect(UA.androidBrave, { isBrave: true }),
        BrowserPlatform.ANDROID,
        BrowserName.BRAVE,
        BrowserStatus.NOT_RECOMMENDED
    );
    check(
        detect(UA.androidBrave, {
            brands: [
                { brand: 'Brave', version: '129' },
                { brand: 'Chromium', version: '129' },
            ],
        }),
        BrowserPlatform.ANDROID,
        BrowserName.BRAVE,
        BrowserStatus.NOT_RECOMMENDED
    );
});

test('Android brands identify Chromium browsers with Chrome user agents', () => {
    const cases: [string, BrowserName][] = [
        ['Microsoft Edge', BrowserName.EDGE],
        ['Opera', BrowserName.OPERA],
        ['Samsung Internet', BrowserName.SAMSUNG],
        ['Android WebView', BrowserName.WEBVIEW],
    ];

    for (const [brand, browser] of cases) {
        check(
            detect(UA.androidChrome, {
                brands: [
                    { brand: 'Chromium', version: '129' },
                    { brand, version: '129' },
                ],
            }),
            BrowserPlatform.ANDROID,
            browser,
            BrowserStatus.NOT_RECOMMENDED
        );
    }
});

test('Chromium brand without Google Chrome is another browser', () => {
    // What Vivaldi and similar browsers report.
    check(
        detect(UA.androidChrome, {
            brands: [
                { brand: 'Chromium', version: '129' },
                { brand: 'Not=A?Brand', version: '8' },
            ],
        }),
        BrowserPlatform.ANDROID,
        BrowserName.CHROMIUM,
        BrowserStatus.NOT_RECOMMENDED
    );
});

test('unrecognizable brands fall back to the user agent', () => {
    check(
        detect(UA.androidChrome, {
            brands: [{ brand: 'Not=A?Brand', version: '8' }],
        }),
        BrowserPlatform.ANDROID,
        BrowserName.CHROME,
        BrowserStatus.PROBABLY_RECOMMENDED
    );
});

test('iOS Safari is probably recommended, never certain', () => {
    const result = detect(UA.iosSafari, { maxTouchPoints: 5 });
    check(result, BrowserPlatform.IOS, BrowserName.SAFARI, BrowserStatus.PROBABLY_RECOMMENDED);
    assert.equal(result.recommended, BrowserName.SAFARI);
});

test('iPad asking for the desktop site looks like Safari', () => {
    check(
        detect(UA.ipadDesktop, { maxTouchPoints: 5 }),
        BrowserPlatform.IOS,
        BrowserName.SAFARI,
        BrowserStatus.PROBABLY_RECOMMENDED
    );
});

test('iOS browsers that name themselves', () => {
    const cases: [string, BrowserName][] = [
        [UA.iosChrome, BrowserName.CHROME],
        [UA.ipadChrome, BrowserName.CHROME],
        [UA.iosFirefox, BrowserName.FIREFOX],
        [UA.iosEdge, BrowserName.EDGE],
        [UA.iosOpera, BrowserName.OPERA],
        [UA.iosDuckDuckGo, BrowserName.DUCKDUCKGO],
        [UA.iosGoogleApp, BrowserName.GOOGLE_APP],
        [UA.iosFacebook, BrowserName.IN_APP],
        [UA.iosInstagram, BrowserName.IN_APP],
    ];

    for (const [userAgent, browser] of cases) {
        const result = detect(userAgent);
        check(result, BrowserPlatform.IOS, browser, BrowserStatus.NOT_RECOMMENDED);
        assert.equal(result.recommended, BrowserName.SAFARI);
    }
});

test('Chrome on iOS is not recommended even though it is Chrome', () => {
    assert.equal(detect(UA.iosChrome).showNotice, true);
});

test('Brave on iOS is found by navigator.brave', () => {
    check(
        detect(UA.iosSafari, { isBrave: true }),
        BrowserPlatform.IOS,
        BrowserName.BRAVE,
        BrowserStatus.NOT_RECOMMENDED
    );
});

test('iOS web view without Safari token is an in-app browser', () => {
    check(
        detect(UA.iosWebView),
        BrowserPlatform.IOS,
        BrowserName.IN_APP,
        BrowserStatus.NOT_RECOMMENDED
    );
});

test('iOS Home Screen app is not mistaken for an in-app browser', () => {
    check(
        detect(UA.iosWebView, { standalone: true }),
        BrowserPlatform.IOS,
        BrowserName.HOME_SCREEN,
        BrowserStatus.PROBABLY_RECOMMENDED
    );
});

test('desktop browsers never show the notice', () => {
    for (const userAgent of [UA.windowsChrome, UA.linuxFirefox, UA.macSafari]) {
        const result = detect(userAgent, { maxTouchPoints: 0 });
        check(result, BrowserPlatform.OTHER, BrowserName.UNKNOWN, BrowserStatus.UNKNOWN);
        assert.equal(result.recommended, null);
    }
});

test('garbage input shows nothing', () => {
    for (const userAgent of ['', 'curl/8.0', 'Mozilla/5.0']) {
        assert.equal(detect(userAgent).showNotice, false);
    }

    assert.equal(
        detect('Mozilla/5.0 (Linux; Android 14)').status,
        BrowserStatus.UNKNOWN
    );
    assert.equal(
        detect('Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X)').status,
        BrowserStatus.UNKNOWN
    );
});
