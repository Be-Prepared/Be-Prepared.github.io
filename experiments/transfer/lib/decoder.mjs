// Decodability checks for LT-style codes over GF(2).
//
// Rather than moving real data, these work on the index lists only: a set
// of equations determines every source block exactly when the matching
// 0/1 matrix has full column rank. That's the same success condition as
// a real decoder, without the cost of XORing payloads.

// Peeling (belief propagation), the standard LT decoder and what the app
// uses. Returns the symbols it could not resolve.
export function peel(equations, n, k) {
    const count = new Int32Array(n);
    const xorIndex = new Int32Array(n);
    const known = new Uint8Array(k);
    const degreeOf = new Int32Array(k + 1);

    for (let e = 0; e < n; e += 1) {
        const eq = equations[e];
        count[e] = eq.length;

        for (const s of eq) {
            xorIndex[e] ^= s;
            degreeOf[s + 1] += 1;
        }
    }

    // Compressed adjacency: equations that contain each symbol.
    for (let s = 0; s < k; s += 1) {
        degreeOf[s + 1] += degreeOf[s];
    }

    const adjacency = new Int32Array(degreeOf[k]);
    const fill = degreeOf.slice(0, k);

    for (let e = 0; e < n; e += 1) {
        for (const s of equations[e]) {
            adjacency[fill[s]] = e;
            fill[s] += 1;
        }
    }

    const queue = [];

    for (let e = 0; e < n; e += 1) {
        if (count[e] === 1) {
            queue.push(e);
        }
    }

    let resolved = 0;

    while (queue.length) {
        const e = queue.pop();

        if (count[e] !== 1) {
            continue;
        }

        const s = xorIndex[e];

        if (known[s]) {
            continue;
        }

        known[s] = 1;
        resolved += 1;

        for (let i = degreeOf[s]; i < degreeOf[s + 1]; i += 1) {
            const other = adjacency[i];
            count[other] -= 1;
            xorIndex[other] ^= s;

            if (count[other] === 1) {
                queue.push(other);
            }
        }
    }

    return { count, known, resolved };
}

// Gaussian elimination on what peeling leaves behind. Returns true when the
// leftover equations pin down every leftover symbol.
function residualSolvable(equations, n, k, peeled) {
    const unknown = [];
    const column = new Int32Array(k).fill(-1);

    for (let s = 0; s < k; s += 1) {
        if (!peeled.known[s]) {
            column[s] = unknown.length;
            unknown.push(s);
        }
    }

    const r = unknown.length;
    const words = (r + 31) >>> 5;
    const rows = [];

    for (let e = 0; e < n; e += 1) {
        if (peeled.count[e] < 2) {
            continue;
        }

        const row = new Uint32Array(words);

        for (const s of equations[e]) {
            const c = column[s];

            if (c >= 0) {
                row[c >>> 5] |= 1 << (c & 31);
            }
        }

        rows.push(row);
    }

    if (rows.length < r) {
        return false;
    }

    let top = 0;

    for (let c = 0; c < r; c += 1) {
        const word = c >>> 5;
        const bit = 1 << (c & 31);
        let pivot = -1;

        for (let i = top; i < rows.length; i += 1) {
            if (rows[i][word] & bit) {
                pivot = i;
                break;
            }
        }

        if (pivot < 0) {
            // A column with no pivot: that symbol can't be determined.
            return false;
        }

        [rows[top], rows[pivot]] = [rows[pivot], rows[top]];
        const pivotRow = rows[top];

        for (let i = top + 1; i < rows.length; i += 1) {
            const row = rows[i];

            if (row[word] & bit) {
                for (let w = word; w < words; w += 1) {
                    row[w] ^= pivotRow[w];
                }
            }
        }

        top += 1;
    }

    return true;
}

// `mode` is "peel" (the app today) or "peel+ge" (peel, then solve the rest).
export function decodable(equations, n, k, mode) {
    const peeled = peel(equations, n, k);

    if (peeled.resolved === k) {
        return { ok: true, residual: 0 };
    }

    if (mode === 'peel') {
        return { ok: false, residual: k - peeled.resolved };
    }

    return {
        ok: residualSolvable(equations, n, k, peeled),
        residual: k - peeled.resolved,
    };
}

// Inactivation decoding (as used by Raptor codes) succeeds in exactly the
// same cases as peeling plus Gaussian elimination, but it keeps the dense
// part small: when peeling stalls, it sets a few source blocks aside as
// unknowns ("inactivates" them) and keeps peeling. Only the inactivated
// blocks need elimination at the end, so the decode cost is roughly
// (inactivated)³ ÷ 32 word operations instead of k³ ÷ 32.
//
// Returns how many blocks had to be inactivated to get through the first
// n equations. Uses the usual greedy rule: take an equation with the
// fewest unresolved blocks and inactivate all but one of them.
export function inactivations(equations, n, k) {
    const count = new Int32Array(n);
    const known = new Uint8Array(k);
    const degreeOf = new Int32Array(k + 1);

    for (let e = 0; e < n; e += 1) {
        count[e] = equations[e].length;

        for (const s of equations[e]) {
            degreeOf[s + 1] += 1;
        }
    }

    for (let s = 0; s < k; s += 1) {
        degreeOf[s + 1] += degreeOf[s];
    }

    const adjacency = new Int32Array(degreeOf[k]);
    const fill = degreeOf.slice(0, k);

    for (let e = 0; e < n; e += 1) {
        for (const s of equations[e]) {
            adjacency[fill[s]] = e;
            fill[s] += 1;
        }
    }

    let resolved = 0;
    let inactive = 0;
    const queue = [];
    const settle = (s) => {
        known[s] = 1;
        resolved += 1;

        for (let i = degreeOf[s]; i < degreeOf[s + 1]; i += 1) {
            const other = adjacency[i];
            count[other] -= 1;

            if (count[other] === 1) {
                queue.push(other);
            }
        }
    };

    for (let e = 0; e < n; e += 1) {
        if (count[e] === 1) {
            queue.push(e);
        }
    }

    while (resolved < k) {
        while (queue.length) {
            const e = queue.pop();

            if (count[e] !== 1) {
                continue;
            }

            const s = equations[e].find((x) => !known[x]);

            if (s !== undefined) {
                settle(s);
            }
        }

        if (resolved >= k) {
            break;
        }

        // Stalled: find the equation with the fewest unresolved blocks.
        let best = -1;

        for (let e = 0; e < n; e += 1) {
            if (count[e] >= 2 && (best < 0 || count[e] < count[best])) {
                best = e;

                if (count[e] === 2) {
                    break;
                }
            }
        }

        if (best < 0) {
            // Remaining blocks aren't in any equation; they'd all have to
            // be inactivated (and can't be solved without more frames).
            inactive += k - resolved;
            break;
        }

        const unresolved = equations[best].filter((x) => !known[x]);

        for (const s of unresolved.slice(1)) {
            inactive += 1;
            settle(s);
        }
    }

    return inactive;
}

// Exact decodability via inactivation, fast enough for large k.
//
// Each block is either solved by peeling or inactivated (made an unknown).
// A solved block's value is tracked as a combination (a bit set, here a
// BigInt) of the inactivated blocks. Equations whose blocks are all known
// then become equations over the inactivated blocks alone, and the file
// decodes exactly when those have full rank. This is the same condition as
// full Gaussian elimination, but the elimination is only over the
// inactivated blocks.
export function decodableByInactivation(equations, n, k) {
    const count = new Int32Array(n);
    const used = new Uint8Array(n);
    const acc = new Array(n).fill(0n);
    const value = new Array(k);
    const known = new Uint8Array(k);
    const degreeOf = new Int32Array(k + 1);

    for (let e = 0; e < n; e += 1) {
        count[e] = equations[e].length;

        for (const s of equations[e]) {
            degreeOf[s + 1] += 1;
        }
    }

    for (let s = 0; s < k; s += 1) {
        degreeOf[s + 1] += degreeOf[s];
    }

    const adjacency = new Int32Array(degreeOf[k]);
    const fill = degreeOf.slice(0, k);

    for (let e = 0; e < n; e += 1) {
        for (const s of equations[e]) {
            adjacency[fill[s]] = e;
            fill[s] += 1;
        }
    }

    let resolved = 0;
    let inactive = 0;
    const queue = [];
    const settle = (s, v) => {
        known[s] = 1;
        value[s] = v;
        resolved += 1;

        for (let i = degreeOf[s]; i < degreeOf[s + 1]; i += 1) {
            const other = adjacency[i];
            count[other] -= 1;
            acc[other] ^= v;

            if (count[other] === 1) {
                queue.push(other);
            }
        }
    };

    for (let e = 0; e < n; e += 1) {
        if (count[e] === 1) {
            queue.push(e);
        }
    }

    while (resolved < k) {
        while (queue.length) {
            const e = queue.pop();

            if (count[e] !== 1 || used[e]) {
                continue;
            }

            const s = equations[e].find((x) => !known[x]);

            if (s !== undefined) {
                // s = (frame data) ^ acc[e]; only the dependence on
                // inactivated blocks matters for rank.
                used[e] = 1;
                settle(s, acc[e]);
            }
        }

        if (resolved >= k) {
            break;
        }

        let best = -1;

        for (let e = 0; e < n; e += 1) {
            if (!used[e] && count[e] >= 2 && (best < 0 || count[e] < count[best])) {
                best = e;

                if (count[e] === 2) {
                    break;
                }
            }
        }

        if (best < 0) {
            // Blocks in no remaining equation can never be solved.
            return { ok: false, inactive: inactive + (k - resolved) };
        }

        const unresolved = equations[best].filter((x) => !known[x]);

        for (const s of unresolved.slice(1)) {
            settle(s, 1n << BigInt(inactive));
            inactive += 1;
        }
    }

    // Equations not used to solve a block, now over inactivated blocks only.
    const rows = [];

    for (let e = 0; e < n; e += 1) {
        if (!used[e] && acc[e] !== 0n) {
            rows.push(acc[e]);
        }
    }

    let rank = 0;

    for (let bit = 0; bit < inactive && rank < inactive; bit += 1) {
        const mask = 1n << BigInt(bit);
        const pivot = rows.findIndex((row, i) => i >= rank && (row & mask) !== 0n);

        if (pivot < 0) {
            return { ok: false, inactive };
        }

        [rows[rank], rows[pivot]] = [rows[pivot], rows[rank]];

        for (let i = rank + 1; i < rows.length; i += 1) {
            if (rows[i] & mask) {
                rows[i] ^= rows[rank];
            }
        }

        rank += 1;
    }

    return { ok: rank === inactive, inactive };
}
