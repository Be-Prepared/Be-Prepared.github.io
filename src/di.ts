type Constructor<T> = new () => T;

export const registered = new Map<Object, Object>();

const circular: Object[] = [];

export const di = <T>(Key: Constructor<T>): T => {
    if (circular.includes(Key)) {
        circular.push(Key);
        throw new Error(
            `Circular dependency: ${circular
                .map((Key) => `${(Key as any).name}`)
                .join(' -> ')}`
        );
    }

    circular.push(Key);
    const value =
        registered.get(Key) ||
        registered.set(Key, new Key() as Object).get(Key);
    circular.pop();

    return value as T;
};
