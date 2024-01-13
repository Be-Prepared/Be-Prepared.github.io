export class TorchService {
    #lastMatch?: MediaStreamTrack | null = null;

    browserSupport() {
        return !!window.navigator.mediaDevices;
    }

    getVideoTrackWithTorch() {
        if (this.#lastMatch !== null) {
            return Promise.resolve(this.#lastMatch);
        }

        return window.navigator.mediaDevices
            .getUserMedia({
                video: {
                    facingMode: 'environment',
                },
            })
            .then(
                (stream) => {
                    this.#lastMatch = stream
                        .getVideoTracks()
                        .filter(
                            (track) => (track.getCapabilities() as any).torch
                        )[0];

                    return this.#lastMatch;
                }
            )
            .catch(() => null);
    }

    toggleTorch(state: boolean) {
        return this.getVideoTrackWithTorch().then((track) => {
            if (track) {
                track.applyConstraints({
                    advanced: [{torch: state} as any]
                });
            }
        });
    }
}
