// Fountain code for sending a file as an endless stream of QR codes.
//
// Every frame is the XOR of some source blocks. Which blocks is decided by
// a 32-bit seed in the frame, so sender and receiver derive the same list
// without sending it. Seeds are random, so every frame is independent and
// identically distributed: the receiver's chance of finishing depends only
// on how many frames it has decoded, not on which ones it missed or when it
// started watching. See experiments/transfer/README.md for the numbers.
//
// * Most frames use a robust soliton degree distribution (Luby, 2002).
// * DENSE_SHARE of frames XOR a random half of all blocks. They close the
//   rare gap where some block never landed in any other frame, which is
//   what made plain LT codes need 30-60% extra frames in bad runs.
// * The decoder peels as frames arrive (cheap, and shows progress). Once
//   it has k frames, it finishes with inactivation decoding, which solves
//   the file whenever the frames determine it at all, by eliminating over
//   a few dozen blocks instead of all k.

// Chosen by experiments/transfer/robust.mjs.
const SOLITON_C = 0.03;
const SOLITON_DELTA = 0.5;
export const DENSE_SHARE = 0.02;
// Share of all blocks in each dense frame.
export const DENSE_DENSITY = 0.5;

// Small, fast, and identical everywhere. Not for cryptography.
export function mulberry32(seed: number) {
    let a = seed >>> 0;

    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Cumulative probabilities for degrees 1..k.
export function robustSoliton(k: number) {
    const R = SOLITON_C * Math.log(k / SOLITON_DELTA) * Math.sqrt(k);
    const spike = Math.max(1, Math.min(k, Math.floor(k / R)));
    const weights: number[] = [];
    let total = 0;

    for (let d = 1; d <= k; d += 1) {
        let w = d === 1 ? 1 / k : 1 / (d * (d - 1));

        if (d < spike) {
            w += R / (d * k);
        } else if (d === spike) {
            w += (R * Math.log(R / SOLITON_DELTA)) / k;
        }

        total += w;
        weights.push(total);
    }

    return weights.map((w) => w / total);
}

// Builds the function that turns a seed into the source block indices.
export function frameIndexer(k: number, density = DENSE_DENSITY) {
    const cumulative = robustSoliton(k);

    return (seed: number): number[] => {
        const rng = mulberry32(seed);

        if (rng() < DENSE_SHARE) {
            const indices: number[] = [];

            for (let i = 0; i < k; i += 1) {
                if (rng() < density) {
                    indices.push(i);
                }
            }

            if (!indices.length) {
                indices.push(Math.floor(rng() * k));
            }

            return indices;
        }

        const r = rng();
        let low = 0;
        let high = cumulative.length - 1;

        while (low < high) {
            const mid = (low + high) >>> 1;

            if (r < cumulative[mid]) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }

        const degree = low + 1;
        const indices = new Set<number>();

        while (indices.size < degree) {
            indices.add(Math.floor(rng() * k));
        }

        return Array.from(indices);
    };
}

export function xorInto(target: Uint8Array, source: Uint8Array) {
    let i = 0;

    // Four bytes at a time when both line up, which they do for blocks
    // this file creates.
    if (!(target.byteOffset & 3) && !(source.byteOffset & 3)) {
        const words = target.length >>> 2;
        const t = new Uint32Array(target.buffer, target.byteOffset, words);
        const s = new Uint32Array(source.buffer, source.byteOffset, words);

        for (; i < words; i += 1) {
            t[i] ^= s[i];
        }

        i = words << 2;
    }

    for (; i < target.length; i += 1) {
        target[i] ^= source[i];
    }
}

// Builds frames from source blocks. Blocks are padded to the same length.
export class FountainEncoder {
    readonly k: number;
    private _blocks: Uint8Array[];
    private _indexer: (seed: number) => number[];

    constructor(blocks: Uint8Array[], density = DENSE_DENSITY) {
        this.k = blocks.length;
        this._blocks = blocks;
        this._indexer = frameIndexer(this.k, density);
    }

    frame(seed: number) {
        const result = new Uint8Array(this._blocks[0].length);

        for (const index of this._indexer(seed)) {
            xorInto(result, this._blocks[index]);
        }

        return result;
    }
}

interface Equation {
    blocks: number[];
    data: Uint8Array;
    // Blocks in this equation that aren't solved yet.
    remaining: number;
    done: boolean;
}

export class FountainDecoder {
    readonly k: number;
    // Blocks solved so far.
    decodedCount = 0;
    // Frames received, including ones that didn't help yet.
    receivedCount = 0;
    private _equations: Equation[] = [];
    // Set once the frames are known to be enough; does the block work.
    private _finish: (() => void) | null = null;
    private _indexer: (seed: number) => number[];
    private _lastAttempt = 0;
    private _values: (Uint8Array | null)[];
    private _waiting: number[][];

    constructor(k: number, density = DENSE_DENSITY) {
        this.k = k;
        this._indexer = frameIndexer(k, density);
        this._values = new Array(k).fill(null);
        this._waiting = Array.from({ length: k }, () => []);
    }

    // True once the frames received are enough to rebuild the file.
    get done() {
        return this.decodedCount === this.k || !!this._finish;
    }

    // Adds a frame. Returns true once every block is known.
    add(seed: number, data: Uint8Array) {
        if (this.done) {
            return true;
        }

        this.receivedCount += 1;
        const id = this._equations.length;
        const equation: Equation = {
            blocks: this._indexer(seed),
            data: data.slice(),
            remaining: 0,
            done: false,
        };
        this._equations.push(equation);

        for (const block of equation.blocks) {
            const value = this._values[block];

            if (value) {
                xorInto(equation.data, value);
            } else {
                equation.remaining += 1;
                this._waiting[block].push(id);
            }
        }

        if (equation.remaining === 0) {
            // Nothing new in this frame.
            equation.done = true;
        } else if (equation.remaining === 1) {
            this._peel([id]);
        }

        // Peeling usually stalls a little before the end. Elimination
        // finishes the job once there's enough to work with; it is tried
        // every 0.2% of k frames so its cost stays small.
        if (
            !this.done &&
            this.receivedCount >= this.k &&
            this.receivedCount - this._lastAttempt >= Math.max(1, Math.floor(this.k / 500))
        ) {
            this._lastAttempt = this.receivedCount;
            this._inactivate();
        }

        return this.done;
    }

    // The decoded blocks, in order. Call only when done. For a large file
    // this can take a moment, so show that something is happening first.
    blocks() {
        const finish = this._finish;
        this._finish = null;
        finish?.();

        return this._values as Uint8Array[];
    }

    private _solve(block: number, value: Uint8Array) {
        const queue: number[] = [];
        this._values[block] = value;
        this.decodedCount += 1;

        for (const other of this._waiting[block]) {
            const equation = this._equations[other];

            if (equation.done) {
                continue;
            }

            xorInto(equation.data, value);
            equation.remaining -= 1;

            if (equation.remaining === 1) {
                queue.push(other);
            } else if (equation.remaining === 0) {
                equation.done = true;
            }
        }

        this._waiting[block] = [];

        return queue;
    }

    private _peel(queue: number[]) {
        while (queue.length) {
            const equation = this._equations[queue.pop()!];

            if (equation.done || equation.remaining !== 1) {
                continue;
            }

            const block = equation.blocks.find((b) => !this._values[b])!;
            equation.done = true;
            queue.push(...this._solve(block, equation.data));
        }
    }

    // Inactivation decoding over the equations peeling couldn't use.
    //
    // 1. Plan: peel structurally. When stuck, pick the equation with the
    //    fewest unknown blocks and "inactivate" all but one of them (treat
    //    them as unknowns to solve for later), which lets peeling continue.
    // 2. Express every block peeled in step 1 as a known part XOR some
    //    combination of the inactivated blocks (a bit mask).
    // 3. Equations left over become equations over the inactivated blocks
    //    only. If they have full rank, solve them by Gaussian elimination;
    //    otherwise more frames are needed and nothing has changed.
    // 4. Substitute back in the order from step 1.
    private _inactivate() {
        const pending: number[] = [];

        for (let id = 0; id < this._equations.length; id += 1) {
            if (!this._equations[id].done) {
                pending.push(id);
            }
        }

        const unknown = this._values.map((v) => !v);
        const remaining = pending.map((id) => this._equations[id].remaining);
        const used = new Uint8Array(pending.length);
        // block -> positions in `pending`
        const where = new Map<number, number[]>();

        pending.forEach((id, p) => {
            for (const block of this._equations[id].blocks) {
                if (unknown[block]) {
                    let list = where.get(block);

                    if (!list) {
                        list = [];
                        where.set(block, list);
                    }

                    list.push(p);
                }
            }
        });

        if (where.size < this.k - this.decodedCount) {
            // Some block isn't in any frame yet.
            return;
        }

        // Step 1. Each step either solves a block from an equation or
        // inactivates a block.
        const order: [block: number, equation: number][] = [];
        const inactive: number[] = [];
        const settled = new Uint8Array(this.k);
        const queue: number[] = [];
        const settle = (block: number) => {
            settled[block] = 1;

            for (const p of where.get(block)!) {
                remaining[p] -= 1;

                if (remaining[p] === 1) {
                    queue.push(p);
                }
            }
        };
        let left = where.size;

        while (left > 0) {
            while (queue.length) {
                const p = queue.pop()!;

                if (used[p] || remaining[p] !== 1) {
                    continue;
                }

                const block = this._equations[pending[p]].blocks.find(
                    (b) => unknown[b] && !settled[b]
                )!;
                used[p] = 1;
                order.push([block, p]);
                settle(block);
                left -= 1;
            }

            if (left === 0) {
                break;
            }

            let best = -1;

            for (let p = 0; p < pending.length; p += 1) {
                if (!used[p] && remaining[p] >= 2 && (best < 0 || remaining[p] < remaining[best])) {
                    best = p;

                    if (remaining[p] === 2) {
                        break;
                    }
                }
            }

            if (best < 0) {
                return;
            }

            const open = this._equations[pending[best]].blocks.filter(
                (b) => unknown[b] && !settled[b]
            );

            for (const block of open.slice(1)) {
                inactive.push(block);
                settle(block);
                left -= 1;
            }

            queue.push(best);
        }

        // Step 2. Masks over the inactivated blocks. Only masks for now:
        // most attempts fail, and checking the rank needs no block data.
        const words = Math.max(1, Math.ceil(inactive.length / 32));
        const masks = new Map<number, Uint32Array>();

        inactive.forEach((block, i) => {
            const mask = new Uint32Array(words);
            mask[i >>> 5] = 1 << (i & 31);
            masks.set(block, mask);
        });

        const maskOf = (p: number, skip: number) => {
            const mask = new Uint32Array(words);

            for (const block of this._equations[pending[p]].blocks) {
                if (unknown[block] && block !== skip) {
                    const other = masks.get(block)!;

                    for (let w = 0; w < words; w += 1) {
                        mask[w] ^= other[w];
                    }
                }
            }

            return mask;
        };

        for (const [block, p] of order) {
            masks.set(block, maskOf(p, block));
        }

        // Step 3a. Unused equations constrain the inactivated blocks. Find
        // inactive.length independent ones, or give up until more frames
        // arrive. A pivot row's original equation is independent of the
        // earlier pivots', so the originals can be solved directly below.
        const rows: { mask: Uint32Array; p: number }[] = [];

        for (let p = 0; p < pending.length; p += 1) {
            if (!used[p]) {
                rows.push({ mask: maskOf(p, -1), p });
            }
        }

        // Prefer small equations as pivots: their data is cheaper to build
        // than the dense frames'.
        const sizeOf = (p: number) => this._equations[pending[p]].blocks.length;
        rows.sort((a, b) => sizeOf(a.p) - sizeOf(b.p));

        for (let i = 0; i < inactive.length; i += 1) {
            const word = i >>> 5;
            const bit = 1 << (i & 31);
            let pivot = -1;

            for (let r = i; r < rows.length; r += 1) {
                if (rows[r].mask[word] & bit) {
                    pivot = r;
                    break;
                }
            }

            if (pivot < 0) {
                return;
            }

            [rows[i], rows[pivot]] = [rows[pivot], rows[i]];

            for (let r = i + 1; r < rows.length; r += 1) {
                if (rows[r].mask[word] & bit) {
                    for (let w = 0; w < words; w += 1) {
                        rows[r].mask[w] ^= rows[i].mask[w];
                    }
                }
            }
        }

        // The frames are enough. The rest touches block data and is the
        // slow part, so it waits until the blocks are asked for.
        this._finish = () => this._substitute(pending, unknown, order, inactive, rows, words, maskOf);
    }

    private _substitute(
        pending: number[],
        unknown: boolean[],
        order: [block: number, equation: number][],
        inactive: number[],
        rows: { p: number }[],
        words: number,
        maskOf: (p: number, skip: number) => Uint32Array
    ) {
        // Step 3b. Now the data. Each peeled block is its equation's data
        // XOR the other blocks' known parts, plus a mix of inactivated
        // blocks (its mask).
        const size = this._equations[pending[0]].data.length;
        const known = new Map<number, Uint8Array>();
        const dataOf = (p: number, skip: number) => {
            const data = this._equations[pending[p]].data.slice();

            for (const block of this._equations[pending[p]].blocks) {
                if (unknown[block] && block !== skip) {
                    xorInto(data, known.get(block)!);
                }
            }

            return data;
        };

        for (const block of inactive) {
            known.set(block, new Uint8Array(size));
        }

        for (const [block, p] of order) {
            known.set(block, dataOf(p, block));
        }

        const system = rows.slice(0, inactive.length).map(({ p }) => ({
            data: dataOf(p, -1),
            mask: maskOf(p, -1),
        }));

        for (let i = 0; i < inactive.length; i += 1) {
            const word = i >>> 5;
            const bit = 1 << (i & 31);
            let pivot = i;

            while (!(system[pivot].mask[word] & bit)) {
                pivot += 1;
            }

            [system[i], system[pivot]] = [system[pivot], system[i]];

            for (let r = 0; r < system.length; r += 1) {
                if (r !== i && system[r].mask[word] & bit) {
                    for (let w = 0; w < words; w += 1) {
                        system[r].mask[w] ^= system[i].mask[w];
                    }

                    xorInto(system[r].data, system[i].data);
                }
            }
        }

        // Row i now holds inactivated block i alone.
        const solved = system.map((row) => row.data);

        // Step 4. Substitute back in step 1's order. Every block is now
        // known, so the leftover frames are no longer needed.
        inactive.forEach((block, i) => (this._values[block] = solved[i]));

        for (const [block, p] of order) {
            const equation = this._equations[pending[p]];
            const value = equation.data;

            for (const other of equation.blocks) {
                if (other !== block && unknown[other]) {
                    xorInto(value, this._values[other]!);
                }
            }

            this._values[block] = value;
        }

        this.decodedCount = this.k;
        this._equations = [];
        this._waiting = [];
    }
}
