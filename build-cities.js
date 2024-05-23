#!/usr/bin/env node

import { createInterface } from 'readline';
import { stat, writeFile } from 'fs/promises';
import { default as StreamZip } from 'node-stream-zip';

function downloadFile(url, filename) {
    console.log(`Downloading ${url} to ${filename}`);

    return fetch(url).then((response) => {
        if (!response.ok) {
            throw new Error(`Failed to download file: ${response.statusText}`);
        }

        console.log(`Download complete, saving to ${filename}`);

        return writeFile(filename, response.body);
    });
}

function refreshFile(url, filename) {
    return stat(filename)
        .then((stats) => {
            if (Date.now() - stats.mtimeMs > 86400000 * 30) {
                console.log(`${filename} is too old, downloading a new one`);

                return downloadFile(url, filename);
            }

            console.log('File is up to date');
        }, (err) => {
            if (err.code === 'ENOENT') {
                console.log(`${filename} not found, downloading a new one`);

                return downloadFile(url, filename);
            }
        }).then(() => filename);
}

function getEntryData(filename) {
    function getNext() {
        if (list.length === 0) {
            return content;
        }

        const entryName = list.shift();

        return zip.entryData(entryName).then((data) => {
            content.push(...data.toString('utf8').split('\n'));

            return getNext();
        });
    }

    const zip = new StreamZip.async({ file: filename });
    const list = [];
    const content = [];

    return zip.entries().then((entries) => {

        for (const entry of Object.values(entries)) {
            if (!entry.isDirectory) {
                list.push(entry.name);
            }
        }

        return getNext();
    });
}

function dropHeaderAndBlankLines(lines) {
    lines.shift();

    return lines.filter((line) => line && line.trim().length > 0);
}

function parseLines(lines) {
    return lines.map((line) => {
        const split = line.split('\t');
        const parsed = {
            // geonameid         : integer id of record in geonames database
            geonameid: parseInt(split[0], 10),
            // name              : name of geographical point (utf8) varchar(200)
            name: split[1],
            // asciiname         : name of geographical point in plain ascii characters, varchar(200)
            asciiname: split[2],
            // alternatenames    : alternatenames, comma separated, ascii names automatically transliterated, convenience attribute from alternatename table, varchar(10000)
            alternatenames: split[3].split(','),
            // latitude          : latitude in decimal degrees (wgs84)
            latitude: parseFloat(split[4]),
            // longitude         : longitude in decimal degrees (wgs84)
            longitude: parseFloat(split[5]),
            // feature class     : see http://www.geonames.org/export/codes.html, char(1)
            featureClass: split[6],
            // feature code      : see http://www.geonames.org/export/codes.html, varchar(10)
            featureCode: split[7],
            // country code      : ISO-3166 2-letter country code, 2 characters
            countryCode: split[8],
            // cc2               : alternate country codes, comma separated, ISO-3166 2-letter country code, 200 characters
            cc2: split[9].split(','),
            // admin1 code       : fipscode (subject to change to iso code), see exceptions below, see file admin1Codes.txt for display names of this code; varchar(20)
            admin1Code: split[10],
            // admin2 code       : code for the second administrative division, a county in the US, see file admin2Codes.txt; varchar(80)
            admin2Code: split[11],
            // admin3 code       : code for third level administrative division, varchar(20)
            admin3Code: split[12],
            // admin4 code       : code for fourth level administrative division, varchar(20)
            admin4Code: split[13],
            // population        : bigint (8 byte int)
            population: parseInt(split[14], 10),
            // elevation         : in meters, integer
            elevation: parseInt(split[15], 10),
            // dem               : digital elevation model, srtm3 or gtopo30, average elevation of 3''x3'' (ca 90mx90m) or 30''x30'' (ca 900mx900m) area in meters, integer. srtm processed by cgiar/ciat.
            dem: parseInt(split[16], 10),
            // timezone          : the iana timezone id (see file timeZone.txt) varchar(40)
            timezone: split[17],
            // modification date : date of last modification in yyyy-MM-dd format
            modificationDate: split[18],
        };

        return parsed;
    });
}

function filterInvalidData(cities) {
    return cities.filter((city) => {
        return !isNaN(city.latitude) && !isNaN(city.longitude) && city.population > 0;
    });
}

function mapToNames(cities) {
    function addToMap(name, city) {
        if (!name) {
            return;
        }

        const lcName = name.toLowerCase();
        const existing = map.get(lcName);

        if (!existing || existing[1].population < city.population) {
            // Preserve this name in case one of the mapped names is
            // overwritten by a larger city but they have different accents.
            // Fake example: Groß versus Gross, maybe Gross has more people
            // than Groß but the ß gets mapped to s.
            //     12345 Groß Gross
            //     98765 Gross
            // This should end up as
            //     98765 Gross
            //     12345 Groß
            map.set(lcName, [name, city]);
        }
    }

    const map = new Map();

    for (const city of cities) {
        addToMap(city.name, city);
        addToMap(city.asciiname, city);
    }

    return map;
}

function convertCoord(coord) {
    coord /= 360;
    let result = '';

    while (result.length < 4) {
        coord *= 92;
        const i = Math.floor(coord);
        result += String.fromCharCode(33 + i);
        coord -= i;
    }

    return result;
}

function convertCoords(lat, lon) {
    return `${convertCoord(lat + 90)}${convertCoord(lon + 180)}`;
}

function convertBackBase92(coords) {
    function convert(chunk) {
        let value = 0;
        let base = 1;

        for (const letter of chunk.split('')) {
            base /= 92;
            const index = letter.charCodeAt(0) - 33;
            value += index * base;
        }

        return value * 360;
    }

    return [
        convert(coords.substr(0, 4)) - 90,
        convert(coords.substr(4, 4)) - 180,
    ];
}

function calculateOffages(city, coords) {
    return [
        city.latitude - coords[0],
        city.longitude - coords[1],
    ];
}

function convertToList(map) {
    const result = [];

    for (const [name, nameAndCity] of map) {
        const [name, city] = nameAndCity;
        const coords = convertCoords(city.latitude, city.longitude);
        const convertedBack = convertBackBase92(coords);
        const offages = calculateOffages(city, convertedBack);
        const newItem = {
            city,
            coords,
            convertedBack,
            offages,
            names: [name],
        };
        result.push(newItem);
    }

    return result;
}

function sortByPopulation(list) {
    return list.sort((a, b) => {
        const diff = b.city.population - a.city.population;

        if (diff) {
            return diff;
        }

        return a.names[0].localeCompare(b.names[0]);
    });
}

function condenseCities(list) {
    return list.reduce((acc, next) => {
        const last = acc[acc.length - 1];

        if (last && last.city === next.city) {
            last.names.push(...next.names);
        } else {
            acc.push(next);
        }

        return acc;
    }, []);
}

function preserveTop(list, count) {
    return list.slice(0, count);
}

function sortByName(list) {
    return list.sort((a, b) => a.names[0].localeCompare(b.names[0]));
}

function convertToFinalForm(list) {
    return list.map((entry) => `${entry.coords}${entry.names.join('|')}`);
}

function writeTextFile(filename, lines) {
    return writeFile(filename, lines.join('\n')).then(() => filename);
}

refreshFile('https://download.geonames.org/export/dump/cities15000.zip', 'cities15000.zip')
    .then((filename) => getEntryData(filename))
    .then((lines) => dropHeaderAndBlankLines(lines))
    .then((lines) => parseLines(lines))
    .then((cities) => filterInvalidData(cities))
    .then((cities) => mapToNames(cities))
    .then((map) => convertToList(map))
    .then((list) => sortByPopulation(list))
    .then((list) => condenseCities(list))
    .then((list) => preserveTop(list, 10000))
    .then((list) => sortByName(list))
    .then((list) => convertToFinalForm(list))
    .then((list) => writeTextFile('site/public/cities.txt', list))
    .then((filename) => {
        console.log(`Wrote ${filename} successfully`);
    });
