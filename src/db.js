import EventEmitter from 'events';
import { getIDBError } from './util.js';
import { Collection } from './collection.js';

/**
 * Db blocked event.
 * @event Db#blocked
 *
 * @example
 * db.on('blocked', () => {
 *     console.log('database version cannot be upgraded');
 * });
 */

/**
 * Class representing a database.
 * @param {string} name The name of the database.
 * @param {number} [version] The version of the database.
 * @param {object|string[]} config The collections configuration.
 *
 * @example
 * let db = new zango.Db('myDb', {
 *     // Define collection.
 *     col1: {
 *         // Create index if it doesn't already exist.
 *         index1: true,
 *
 *         // Delete index from pre-existing database.
 *         index2: false
 *     },
 *
 *      // Define collection with indexes.
 *     col2: ['index1', 'index2'],
 *
 *     // Define collection without indexes.
 *     col3: true,
 *
 *     // Delete collection from pre-existing database.
 *     col4: false
 * });
 *
 * @example
 * // Define collections without indexes.
 * let db = new zango.Db('myDb', ['col1', 'col2']);
 */
export default class Db extends EventEmitter {
    #openingCallbacks = [];
    #openingRequest = undefined;
    constructor(name, version, config) {
        super();

        this._name = name;

        if (typeof version === 'object') {
            config = version;
        } else {
            this._version = version;
        }

        this._cols = {};
        this._config = {};

        if (Array.isArray(config)) {
            for (let name of config) {
                this._addCollection(name);
                this._config[name] = true;
            }
        } else {
            for (let name in config) {
                this._addCollection(name);
                this._addIndex(config[name], name);
            }
        }
    }

    /**
     * The name of the database.
     * @type {string}
     */
    get name() {
        return this._name;
    }

    /**
     * The version of the database.
     * @type {number}
     */
    get version() {
        return this._version;
    }

    _addCollection(name) {
        this._cols[name] = new Collection(this, name);
    }

    _addIndex(index_config, path) {
        const config = this._config;

        if (!index_config) {
            return (config[path] = false);
        }

        if (typeof index_config !== 'object') {
            return (config[path] = {});
        }

        const col = this._cols[path];

        if (Array.isArray(index_config)) {
            const new_value = {};

            for (let index_path of index_config) {
                new_value[index_path] = true;

                col._indexes.add(index_path);
            }

            config[path] = new_value;
        } else {
            for (let index_path in index_config) {
                if (index_config[index_path]) {
                    col._indexes.add(index_path);
                }
            }

            config[path] = index_config;
        }
    }

    _addStore(idb, name) {
        const store = idb.createObjectStore(name, {
            keyPath: '_id',
            autoIncrement: true,
        });

        const index_config = this._config[name];

        for (let path in index_config) {
            if (index_config[path]) {
                store.createIndex(path, path, { unique: false });
            } else {
                store.deleteIndex(path);
            }
        }
    }
    async #getConnectionResult(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = ({ target }) => {
                const idb = target.result;
                this._idb = idb;
                this._version = idb.version;
                this._open = true;
                resolve(idb);
            };
            request.onerror = (e) => {
                reject(getIDBError(e));
            };
            request.onupgradeneeded = ({ target }) => {
                const idb = target.result;
                for (let name in this._config) {
                    try {
                        if (!this._config[name]) {
                            idb.deleteObjectStore(name);
                        } else if (!idb.objectStoreNames.contains(name)) {
                            this._addStore(idb, name);
                        }
                    } catch (error) {
                        reject(error);
                    }
                }
            };
            request.onblocked = (e) => {
                this.emit('blocked');
                reject(e);
            };
        });
    }
    async _getConn() {
        if (this._idb) {
            return Promise.resolve(this._idb);
        }
        if (this.#openingRequest === undefined) {
            if (this._version) {
                this.#openingRequest = indexedDB.open(
                    this._name,
                    this._version
                );
            } else {
                this.#openingRequest = indexedDB.open(this._name);
            }
        }
        return await this.#getConnectionResult(this.#openingRequest).finally(
            () => {
                this.#openingRequest = undefined;
            }
        );
    }
    /**
     * Retrieve a {@link Collection} instance.
     * @param {string} name The name of the collection.
     * @return {Collection}
     *
     * @example
     * let col = db.collection('mycol');
     */
    collection(name) {
        const col = this._cols[name];

        if (!col) {
            throw Error(`collection '${name}' does not exist`);
        }

        return col;
    }

    /**
     * Open connection to the database.
     * @return {Promise}
     */
    async open() {
        return await this._getConn();
    }

    /**
     * Close the connection if it is open.
     */
    close() {
        if (this._open) {
            this._idb.close();
            this._open = false;
        }
    }

    /**
     * Delete the database, closing the connection if it is open.
     * @return {Promise}
     *
     * @example
     * await db.drop();
     */
    drop() {
        this.close();
        const req = indexedDB.deleteDatabase(this._name);
        return new Promise((resolve, reject) => {
            req.onsuccess = () => {
                return resolve();
            };
            req.onerror = (e) => {
                return reject(getIDBError(e));
            };
        });
    }
}
