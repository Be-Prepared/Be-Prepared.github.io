export class EverySecondService {
    callEverySecond(callback: () => void) {
        let timeout: ReturnType<typeof setTimeout>;
        const makeCall = () => {
            callback();

            timeout = setTimeout(makeCall, 1000 - (Date.now() % 1000));
        };
        makeCall();

        return () => clearTimeout(timeout);
    }
}
