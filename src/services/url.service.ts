// https://html.spec.whatwg.org/multipage/system-state.html#safelisted-scheme
const SAFELISTED_SCHEMES = [
    'bitcoin',
    'ftp',
    'ftps',
    'geo',
    'im',
    'irc',
    'ircs',
    'magnet',
    'mailto',
    'matrix',
    'mms',
    'news',
    'nntp',
    'openpgp4fpr',
    'sftp',
    'sip',
    'sms',
    'smsto',
    'ssh',
    'tel',
    'urn',
    'webcal',
    'wtai',
    'xmpp',
];
export class UrlService {
    isUrl(url: string) {
        for (const protocol of SAFELISTED_SCHEMES) {
            if (url.startsWith(`${protocol}:`)) {
                return true;
            }
        }

        return false;
    }
}
