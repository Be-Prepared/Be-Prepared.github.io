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
