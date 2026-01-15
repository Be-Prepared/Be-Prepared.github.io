export function showProbabilities(probabilities) {
    console.log('Size |  Prob  | Visualization');
    const probabilitiesDiff = [];
    let lastProbability = 0;

    for (const probability of probabilities) {
        probabilitiesDiff.push(probability - lastProbability);
        lastProbability = probability;
    }

    const max = Math.max(...probabilitiesDiff);

    probabilitiesDiff.forEach((p, index) => {
        // Show the size (padded left with spaces for alignment),
        // the probability (fixed to 6 decimal places),
        // and a bar made of '#' characters proportional to the probability.
        const barLength = Math.round((p / max) * 50);
        const bar = '#'.repeat(barLength);
        console.log(
            `${String(index + 1).padStart(4, ' ')} | ${p.toFixed(6)} | ${bar}`
        );
    });
}

export function runTests(probabilities, blocks, iterations = 10000) {
    const results = [];
    console.log('');
    console.log(`Running ${iterations} iterations...`);

    for (let i = 0; i < iterations; i++) {
        const loops = runTest(probabilities, blocks);
        results.push(loops);
    }

    const sum = results.reduce((a, b) => a + b, 0);
    const average = sum / iterations;

    const variance =
        results.reduce((a, b) => a + (b - average) ** 2, 0) / iterations;
    const stddev = Math.sqrt(variance);

    console.log(`  Average loops: ${average.toFixed(2)}`);
    console.log(`  Standard deviation: ${stddev.toFixed(2)}`);

    return average;
}

export function runTest(probabilities, blocks) {
    let loops = 0;
    const found = new Set();
    const queue = new Set();

    while (found.size < blocks) {
        loops += 1;

        // Pick a random number between 0 and 1
        const rand = Math.random();

        // Determine the size based on cumulative probabilities
        const size = probabilities.findIndex(p => p >= rand) + 1;

        // Generate 'size' unique random indices
        const indices = new Set();

        while (indices.size < size) {
            indices.add(Math.floor(Math.random() * blocks));
        }

        addIndices(found, queue, indices);
    }

    return loops;
}

function addIndices(found, queue, indices) {
    for (const index of indices) {
        if (found.has(index)) {
            indices.delete(index);
        }
    }

    if (indices.size === 1) {
        found.add([...indices][0]);
        rework(found, queue);
    } else if (indices.size > 1) {
        queue.add(indices);
    }
}

function rework(found, queue) {
    let changedFound = true;

    while (changedFound) {
        changedFound = false;

        for (const item of queue) {
            for (const index of [...item]) {
                if (found.has(index)) {
                    item.delete(index);
                }

                if (item.size === 1) {
                    found.add([...item][0]);
                    changedFound = true;
                    queue.delete(item);
                }
            }

        }
    }
}
