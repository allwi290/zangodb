import memoize from 'memoizee';
import { get } from '../util.js';
import MISSING from './missing_symbol.js';

export class Fields {
    constructor(doc) {
        this._doc = doc;
        this.get = memoize(this.get);
    }

    get(path) {
        let value = MISSING;

        get(this._doc, path.pieces, (obj, field) => {
            value = obj[field];
        });

        return value;
    }

    ensure(paths) {
        for (let path of paths) {
            if (this.get(path) === MISSING) {
                return false;
            }
        }

        return true;
    }
}
