#!/usr/bin/env node

import { createInterface } from 'readline';

const entries = new Map();
let lineNumber = 0;

function processLine(name, lat, lon, population) {
    name = name.trim();
    const nameLc = name.toLowerCase();
    lat = parseFloat(lat);
    lon = parseFloat(lon);
    population = parseInt(population, 10);

    if (isNaN(lat) || isNaN(lon) || isNaN(population) || !population) {
        return;
    }

    if (entries.has(nameLc) && entries.get(nameLc).population >= population) {
        return;
    }

    entries.set(nameLc, { name, lat, lon, population });
}

createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
})
    .on('line', function (line) {
        const values = line.split('\t');

        if (lineNumber !== 0) {
            // [1] = name (UTF-8)
            // [2] = name (ASCII)
            // [4] = latitude
            // [5] = longitude
            // [14] = population
            processLine(values[1], values[4], values[5], values[14]);
            processLine(values[2], values[4], values[5], values[14]);
        }

        lineNumber++;
    })
    .on('close', function () {
        // Sort by population
        const namesTop = [...entries.keys()].sort((a, b) => {
            const aEntry = entries.get(a);
            const bEntry = entries.get(b);

            return bEntry.population - aEntry.population;
        });

        // Keep the most populated cities and sort by name
        const namesSorted = namesTop.slice(0, 10000).sort((a, b) => a.localeCompare(b));
        const result = {};
        let highestPopulation = 0;
        let lowestPopulation = Number.MAX_SAFE_INTEGER;

        for (const nameLc of namesSorted) {
            const value = entries.get(nameLc);
            result[value.name] = [value.lat, value.lon];
            highestPopulation = Math.max(highestPopulation, value.population);
            lowestPopulation = Math.min(lowestPopulation, value.population);
        }

        process.stdout.write(JSON.stringify(result));
        process.stderr.write(`Total cities: ${namesTop.length}
Cities in this list: ${namesSorted.length}
Highest population: ${highestPopulation}
Lowest population: ${lowestPopulation}
`);
    });

// geonameid         : integer id of record in geonames database
// name              : name of geographical point (utf8) varchar(200)
// asciiname         : name of geographical point in plain ascii characters, varchar(200)
// alternatenames    : alternatenames, comma separated, ascii names automatically transliterated, convenience attribute from alternatename table, varchar(10000)
// latitude          : latitude in decimal degrees (wgs84)
// longitude         : longitude in decimal degrees (wgs84)
// feature class     : see http://www.geonames.org/export/codes.html, char(1)
// feature code      : see http://www.geonames.org/export/codes.html, varchar(10)
// country code      : ISO-3166 2-letter country code, 2 characters
// cc2               : alternate country codes, comma separated, ISO-3166 2-letter country code, 200 characters
// admin1 code       : fipscode (subject to change to iso code), see exceptions below, see file admin1Codes.txt for display names of this code; varchar(20)
// admin2 code       : code for the second administrative division, a county in the US, see file admin2Codes.txt; varchar(80)
// admin3 code       : code for third level administrative division, varchar(20)
// admin4 code       : code for fourth level administrative division, varchar(20)
// population        : bigint (8 byte int)
// elevation         : in meters, integer
// dem               : digital elevation model, srtm3 or gtopo30, average elevation of 3''x3'' (ca 90mx90m) or 30''x30'' (ca 900mx900m) area in meters, integer. srtm processed by cgiar/ciat.
// timezone          : the iana timezone id (see file timeZone.txt) varchar(40)
// modification date : date of last modification in yyyy-MM-dd format
