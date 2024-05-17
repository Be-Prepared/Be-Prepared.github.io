export class UrlService {
    isUrl(url: string) {
        for (const protocol of ['http', 'https', 'mailto', 'geo', 'tel', 'sms']) {
            if (url.startsWith(`${protocol}:`)) {
                return true;
            }
        }

        return false;
    }
}
