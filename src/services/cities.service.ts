import { first, map, shareReplay } from 'rxjs/operators';
import { LatLon } from '../datatypes/lat-lon';
import { Observable, ReplaySubject, Subject } from 'rxjs';

export interface City extends LatLon {
    ascii: string | null; // ASCII name
    name: string; // The preferred name/spelling
}

export class CitiesService {
    private _citiesSubject?: ReplaySubject<City[]>;
    private _nameMapObservable?: Observable<Map<string, City>>;

    getCityByName(name: string) {
        return this.getNameMapObservable().pipe(
            map((cities) => {
                const city = cities.get(name.trim().toLowerCase());

                return city
                    ? {
                          ...city,
                      }
                    : null;
            })
        );
    }

    getCitiesObservable() {
        if (!this._citiesSubject) {
            const citiesSubject = new ReplaySubject<City[]>(1);
            this._loadCities(citiesSubject);
            this._citiesSubject = citiesSubject;
        }

        return this._citiesSubject.asObservable().pipe(first());
    }

    getNameMapObservable() {
        if (!this._nameMapObservable) {
            this._nameMapObservable = this.getCitiesObservable().pipe(
                map((cities) => {
                    const map = new Map<string, City>();

                    for (const city of cities) {
                        map.set(city.name.toLowerCase(), city);

                        if (city.ascii) {
                            map.set(city.ascii.toLowerCase(), city);
                        }
                    }

                    return map;
                }),
                shareReplay(1)
            );
        }

        return this._nameMapObservable!;
    }

    private _convertCoord(text: string) {
        let value = 0;
        let base = 1;

        for (const letter of text.split('')) {
            base /= 92;
            value += (letter.charCodeAt(0) - 33) * base;
        }

        return value * 360;
    }

    private _convertTextToCities(text: string) {
        const lines = text.split('\n').filter((line) => line.length > 8);

        return lines.map((line) => {
            const latText = line.substr(0, 4);
            const lonText = line.substr(4, 4);
            const names = line.substr(8).split('|');
            const city = {
                lat: this._convertCoord(latText) - 90,
                lon: this._convertCoord(lonText) - 180,
                name: names[0],
                ascii: names[1] || null,
            };

            return city;
        });
    }

    private _loadCities(subject: Subject<City[]>) {
        fetch('/cities.txt')
            .then((response) => response.text())
            .then(
                (text) => {
                    const cities = this._convertTextToCities(text);
                    subject.next(cities);
                },
                () => {
                    subject.next([]);
                }
            );
    }
}
