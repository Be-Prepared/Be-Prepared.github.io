class LocalStorageMock {
    private _store = new Map<string, string>();

    getItem(key: string) {
        return this._store.get(key) || null;
    }

    removeItem(key: string) {
        this._store.delete(key);
    }

    setItem(key: string, value: string) {
        this._store.set(key, value);
    }
}
const storage =
    typeof localStorage === 'undefined' ? new LocalStorageMock() : localStorage;

export interface LocalStorageInterface<T> {
    getItem: () => T | null;
    reset: () => void;
    setItem: (value: T) => void;
}

export class LocalStorageService {
    static boolean(key: string, version = 1): LocalStorageInterface<boolean> {
        return {
            getItem: () => this._get(key, version),
            reset: () => storage.removeItem(key),
            setItem: (value: boolean) => this._set(key, value, version),
        };
    }

    static enum<T>(
        key: string,
        enumObject: { [key: string]: T },
        version = 1
    ): LocalStorageInterface<T> {
        return this.list(key, [...Object.values(enumObject)], version);
    }

    static json<T>(key: string, version = 1): LocalStorageInterface<T> {
        return {
            getItem: () => this._get(key, version),
            reset: () => storage.removeItem(key),
            setItem: (value: T) => this._set(key, value, version),
        };
    }

    static list<T>(
        key: string,
        allowedValues: T[],
        version = 1
    ): LocalStorageInterface<T> {
        return {
            getItem: () => {
                const value = this._get(key, version);

                return allowedValues.includes(value as T) ? (value as T) : null;
            },
            reset: () => storage.removeItem(key),
            setItem: (value: T) =>
                allowedValues.includes(value)
                    ? this._set(key, value, version)
                    : storage.removeItem(key),
        };
    }

    static string(key: string, version = 1): LocalStorageInterface<string> {
        return {
            getItem: () => this._get(key, version),
            reset: () => storage.removeItem(key),
            setItem: (value: string) => this._set(key, value, version),
        };
    }

    static _get(key: string, version: number) {
        const encoded = storage.getItem(key);

        if (!encoded) {
            return null;
        }

        try {
            const parsed = JSON.parse(encoded);

            if (parsed[0] === version) {
                return parsed.value;
            }
        } catch (_ignore) {}

        return null;
    }

    static _set(key: string, value: any, version: number) {
        storage.setItem(key, JSON.stringify([version, value]));
    }
}
