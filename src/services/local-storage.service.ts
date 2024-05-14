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
};
const storage = typeof localStorage === 'undefined' ? new LocalStorageMock : localStorage;

export interface LocalStorageInterface<T> {
    getItem: () => T | null;
    reset: () => void;
    setItem: (value: T) => void;
}

export class LocalStorageService {
    static boolean(key: string): LocalStorageInterface<boolean> {
        return {
            getItem: () => {
                const value = storage.getItem(key);

                return value === 'true'
                    ? true
                    : value === 'false'
                      ? false
                      : null;
            },
            reset: () => storage.removeItem(key),
            setItem: (value: boolean) => storage.setItem(key, `${value}`),
        };
    }

    static enum<T>(
        key: string,
        enumObject: { [key: string]: T }
    ): LocalStorageInterface<T> {
        return this.list(key, [...Object.values(enumObject)]);
    }

    static json<T>(key: string): LocalStorageInterface<T> {
        return {
            getItem: () => {
                const value = storage.getItem(key);

                try {
                    if (value) {
                        return JSON.parse(value);
                    }
                } catch (ignore) {}

                return null;
            },
            reset: () => storage.removeItem(key),
            setItem: (value: T) => storage.setItem(key, JSON.stringify(value)),
        };
    }

    static list<T>(key: string, allowedValues: T[]): LocalStorageInterface<T> {
        return {
            getItem: () => {
                const value = storage.getItem(key);

                return typeof value === 'string' &&
                    allowedValues.includes(value as T)
                    ? (value as T)
                    : null;
            },
            reset: () => storage.removeItem(key),
            setItem: (value: T) =>
                allowedValues.includes(value)
                    ? storage.setItem(key, value as string)
                    : storage.removeItem(key),
        };
    }

    static string(key: string): LocalStorageInterface<string> {
        return {
            getItem: () => storage.getItem(key) || null,
            reset: () => storage.removeItem(key),
            setItem: (value: string) => storage.setItem(key, value),
        };
    }
}
