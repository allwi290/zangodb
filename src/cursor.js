import EventEmitter from 'events';
import createNextFn from './create_next_fn.js';
import filter from './filter.js';
import { project } from './project.js';
import group from './group.js';
import unwind from './unwind.js';
import sort from './sort.js';
import skip from './skip.js';
import limit from './limit.js';

/**
 * Cursor data event.
 * @event Cursor#data
 * @type {object}
 */

/**
 * Cursor end event.
 * @event Cursor#end
 */

/**
 * Class representing a query cursor.
 * <strong>Note:</strong> The filter, limit, skip, project, group,
 * unwind and sort, methods each add an additional stage to the
 * cursor pipeline and thus do not override any previous invocations.
 */
export class Cursor extends EventEmitter {
    /** <strong>Note:</strong> Do not instantiate directly. */
    #nextFn;
    #pipeline = [];
    #col;
    #read_pref;
    #opened = false;
    constructor(col, read_pref) {
        super();
        this.#col = col;
        this.#read_pref = read_pref;
    }
    get read_pref() {
        return this.#read_pref;
    }
    get col() {
        return this.#col;
    }
    get pipeline() {
        return this.#pipeline;
    }
    async #forEach(fn) {
        return await (async function iterate(cursor) {
            let idb_cur = await cursor.next();
            if (idb_cur) {
                let doc = idb_cur.value;
                fn(doc);
                cursor.emit('data', doc);
                return await iterate(cursor);
            } else {
                return;
            }
        })(this);
    }

    /**
     * Iterate over each document and apply a function.
     * @param {function} [fn] The function to apply to each document.
     * @return {Promise}
     *
     * @example
     * await col.find().forEach((doc) => {
     *     console.log('doc:', doc);
     * });
     */
    async forEach(fn = () => {}) {
        return await this.#forEach(fn);
    }

    async #toArray() {
        const docs = [];
        await this.#forEach((doc) => {
            docs.push(doc);
        });
        return docs;
    }

    /**
     * Collect all documents as an array.
     * @return {Promise}
     *
     * @example
     * let docs = await col.find().toArray();
     *
     * for (let doc of docs) {
     *     console.log('doc:', doc);
     * };
     */
    async toArray() {
        return await this.#toArray();
    }

    #assertUnopened() {
        if (this.#opened) {
            throw Error('cursor has already been opened');
        }
    }

    /**
     * Suggest an index to use.
     * <strong>Note:</strong> When an index hint is used only documents
     * that contain the indexed path will be in the results.
     * @param {string} path An indexed path to use.
     * @return {Cursor}
     *
     * @example
     * col.find().hint('myindex');
     */
    hint(path) {
        this.#assertUnopened();

        if (!this.#col._isIndexed(path)) {
            throw Error(`index '${path}' does not exist`);
        }

        this._hint = path;

        return this;
    }

    #addStage(fn, arg) {
        this.#assertUnopened();
        this.#pipeline.push([fn, arg]);

        return this;
    }

    /**
     * Filter documents.
     * @param {object} expr The query document to filter by.
     * @return {Cursor}
     *
     * @example
     * col.find().filter({ x: 4 });
     */
    filter(expr) {
        return this.#addStage(filter, expr);
    }

    /**
     * Limit the number of documents that can be iterated.
     * @param {number} num The limit.
     * @return {Cursor}
     *
     * @example
     * col.find().limit(10);
     */
    limit(num) {
        return this.#addStage(limit, num);
    }

    /**
     * Skip over a specified number of documents.
     * @param {number} num The number of documents to skip.
     * @return {Cursor}
     *
     * @example
     * col.find().skip(4);
     */
    skip(num) {
        return this.#addStage(skip, num);
    }

    /**
     * Add new fields, and include or exclude pre-existing fields.
     * @param {object} spec Specification for projection.
     * @return {Cursor}
     *
     * @example
     * col.find().project({ _id: 0, x: 1, n: { $add: ['$k', 4] } });
     */
    project(spec) {
        return this.#addStage(project, spec);
    }

    /**
     * Group documents by an _id and optionally add computed fields.
     * @param {object} spec Specification for grouping documents.
     * @return {Cursor}
     *
     * @example
     * col.find().group({
     *     _id: '$author',
     *     books: { $push: '$book' },
     *     count: { $sum: 1 }
     * });
     */
    group(spec) {
        return this.#addStage(group, spec);
    }

    /**
     * Deconstruct an iterable and output a document for each element.
     * @param {string} path A path to an iterable to unwind.
     * @return {Cursor}
     *
     * @example
     * col.find().unwind('$elements');
     */
    unwind(path) {
        return this.#addStage(unwind, path);
    }

    /**
     * Sort documents.
     * <strong>Note:</strong> An index will not be used for sorting
     * unless the query predicate references one of the fields to
     * sort by or {@link Cursor#hint} is used. This is so as not to exclude
     * documents that do not contain the indexed field, in accordance
     * with the functionality of MongoDB.
     * @param {object} spec Specification for sorting.
     * @return {Cursor}
     *
     * @example
     * // No indexes will be used for sorting.
     * col.find().sort({ x: 1 });
     *
     * @example
     * // If x is indexed, it will be used for sorting.
     * col.find({ x: { $gt: 4 } }).sort({ x: 1 });
     *
     * @example
     * // If x is indexed, it will be used for sorting.
     * col.find().sort({ x: 1 }).hint('x');
     */
    sort(spec) {
        return this.#addStage(sort, spec);
    }
    async next() {
        if (!this.#opened) {
            this.#opened = true;
            this.#nextFn = createNextFn(this);
        }
        return await this.#nextFn();
    }
}
