import { getIDBError } from './util.js';
import { Cursor } from './cursor.js';
import { aggregate } from './aggregate.js';
import update from './update.js';
import remove from './remove.js';
/** Class representing a collection. */
export class Collection {
    /** <strong>Note:</strong> Do not instantiate directly. */
    constructor(db, name) {
        this._db = db;
        this._name = name;
        this._indexes = new Set();
    }

    /**
     * The name of the collection.
     * @type {string}
     */
    get name() {
        return this._name;
    }

    _isIndexed(path) {
        return this._indexes.has(path) || path === '_id';
    }

    /**
     * Open a cursor that satisfies the specified query criteria.
     * @param {object} [expr] The query document to filter by.
     * @param {object} [projection_spec] Specification for projection.
     * @return {Cursor}
     *
     * @example
     * col.find({ x: 4, g: { $lt: 10 } }, { k: 0 });
     */
    find(expr, projection_spec) {
        const cur = new Cursor(this, 'readonly');

        cur.filter(expr);

        if (projection_spec) {
            cur.project(projection_spec);
        }

        return cur;
    }

    /**
     * Retrieve one document that satisfies the specified query criteria.
     * @param {object} [expr] The query document to filter by.
     * @param {object} [projection_spec] Specification for projection.
     * @return {Promise}
     *
     * @example
     * col.findOne({ x: 4, g: { $lt: 10 } }, { k: 0 });
     */
    async findOne(expr, projection_spec) {
        const cur = this.find(expr, projection_spec).limit(1);
        let [doc] = await cur.toArray();
        return doc;
    }

    /**
     * Evaluate an aggregation framework pipeline.
     * @param {object[]} pipeline The pipeline.
     * @return {Cursor}
     *
     * @example
     * col.aggregate([
     *     { $match: { x: { $lt: 8 } } },
     *     { $group: { _id: '$x', array: { $push: '$y' } } },
     *     { $unwind: '$array' }
     * ]);
     */
    aggregate(pipeline) {
        return aggregate(this, pipeline);
    }

    _validate(doc) {
        for (let field in doc) {
            if (field[0] === '$') {
                throw Error('field name cannot start with "$"');
            }

            const value = doc[field];

            if (Array.isArray(value)) {
                for (let element of value) {
                    this._validate(element);
                }
            } else if (typeof value === 'object') {
                this._validate(value);
            }
        }
    }

    /**
     * @param {object|object[]} docs Documents to insert.
     * @param {function} [cb] The result callback.
     * @return {Promise}
     *
     * @example
     * col.insert([{ x: 4 }, { k: 8 }], (error) => {
     *     if (error) { throw error; }
     * });
     *
     * @example
     * col.insert({ x: 4 }, (error) => {
     *     if (error) { throw error; }
     * });
     */
    insert(docs) {
        if (!Array.isArray(docs)) {
            docs = [docs];
        }

        return new Promise((resolve, reject) => {
            this._db._getConn((error, idb) => {
                let trans;

                const name = this._name;

                try {
                    trans = idb.transaction([name], 'readwrite');
                } catch (error) {
                    return reject(error);
                }

                trans.oncomplete = () => {
                    return resolve();
                };
                trans.onerror = (e) => {
                    return reject(getIDBError(e));
                };

                const store = trans.objectStore(name);

                let i = 0;

                const iterate = () => {
                    const doc = docs[i];

                    try {
                        this._validate(doc);
                    } catch (error) {
                        return reject(error);
                    }

                    const req = store.add(doc);

                    req.onsuccess = () => {
                        i++;

                        if (i < docs.length) {
                            iterate();
                        }
                    };
                };

                iterate();
            });
        });
    }
    /**
     * Modify documents that match a filter
     * @param {function} fn - Modification function
     * @param {object} expr - The query document to filter by.
     * @returns {Promise}
     */
    #modify(fn, expr) {
        const cur = new Cursor(this, 'readwrite');
        cur.filter(expr);
        return fn(cur);
    }

    /**
     * Update documents that match a filter.
     * @param {object} expr The query document to filter by.
     * @param {object} spec Specification for updating.
     * @return {Promise}
     *
     * @example
     * await col.update({
     *     age: { $gte: 18 }
     * }, {
     *     adult: true
     * });
     */
    update(expr, spec) {
        const fn = (cur) => update(cur, spec);
        return this.#modify(fn, expr);
    }

    /**
     * Delete documents that match a filter.
     * @param {object} expr The query document to filter by.
     * @return {Promise}
     *
     * @example
     * await col.remove({ x: { $ne: 10 } });
     */
    remove(expr) {
        return this.#modify(remove, expr);
    }
}
