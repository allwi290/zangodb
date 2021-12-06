import deepMerge from 'deepmerge';
import clone from 'clone';
import objectHash from 'object-hash';

export function toPathPieces(path) {
    return path.split('.');
}
function hasOwnProperty(object, property) {
    return Object.prototype.hasOwnProperty.call(object, property);
}
/**
 * Returns the object at position pathPieces, if not found then undefined will be returned
 * @param {Object} object
 * @param {Array} pathPieces 
 * @returns {Object}
 */
function exist(object, pathPieces) {
    let [currentPiece, ...restPathPieces] = pathPieces;
    if (restPathPieces.length > 0) {
        if (hasOwnProperty(object, currentPiece)) {
            if (isObject(object[currentPiece])) {
                return exist(object[currentPiece], restPathPieces);
            } 
        }
        return;
    } else if (hasOwnProperty(object, currentPiece)) {
        return object;
    }
    return;
}
export const exists = (obj, path_pieces) => {
    return !!exist(obj, path_pieces);
};

const create = (obj, path_pieces, i) => {
    for (let j = i; j < path_pieces.length - 1; j++) {
        obj[path_pieces[j]] = {};
        obj = obj[path_pieces[j]];
    }

    return obj;
};

export const get = (obj, path_pieces, fn) => {
    if ((obj = exist(obj, path_pieces))) {
        fn(obj, path_pieces[path_pieces.length - 1]);
    }
};

// Set a value, creating the path if it doesn't exist.
export const set = (obj, path_pieces, value) => {
    const fn = (obj, field) => (obj[field] = value);

    modify(obj, path_pieces, fn, fn);
};

export const isObject = (obj) => {
    return typeof obj === 'object' && obj !== null;
};

// Update a value or create it and its path if it doesn't exist.
export const modify = (obj, path_pieces, update, init) => {
    const last = path_pieces[path_pieces.length - 1];

    const _create = (i) => {
        obj = create(obj, path_pieces, i);

        init(obj, last);
    };

    if (hasOwnProperty(obj, path_pieces[0])) {
        if (path_pieces.length > 1) {
            obj = obj[path_pieces[0]];
    
            for (let i = 1; i < path_pieces.length - 1; i++) {
                const piece = path_pieces[i];
    
                if (!isObject(obj[piece])) {
                    return;
                }
                if (Array.isArray(obj) && piece < 0) {
                    return;
                }
    
                if (!hasOwnProperty(obj, piece)) {
                    return _create(i);
                }
    
                obj = obj[piece];
            }
        }
        update(obj, last);
    } else {
        return _create(0);
    }
};

// Delete specified paths from object.
export const remove1 = (obj, path_pieces) => {
    for (var i = 0; i < path_pieces.length - 1; i++) {
        obj = obj[path_pieces[i]];

        if (!isObject(obj)) {
            return;
        }
    }

    if (Array.isArray(obj)) {
        const index = Number.parseFloat(path_pieces[i]);

        if (Number.isInteger(index)) {
            obj.splice(index, 1);
        }
    } else {
        delete obj[path_pieces[i]];
    }
};

const _remove2 = (obj, new_obj, paths) => {
    const fn = (field) => {
        const new_paths = [];

        for (let path_pieces of paths) {
            if (path_pieces[0] !== field) {
                continue;
            }
            if (path_pieces.length === 1) {
                return;
            }

            new_paths.push(path_pieces.slice(1));
        }

        if (!new_paths.length) {
            new_obj[field] = clone(obj[field]);
        } else {
            const value = obj[field];

            new_obj[field] = new value.constructor();

            _remove2(value, new_obj[field], new_paths);
        }
    };

    for (let field in obj) {
        fn(field);
    }
};

// Copy an object ignoring specified paths.
export const remove2 = (obj, paths) => {
    const new_obj = new obj.constructor();

    _remove2(obj, new_obj, paths);

    return new_obj;
};

export const rename = (obj1, path_pieces, new_name) => {
    get(obj1, path_pieces, (obj2, field) => {
        obj2[new_name] = obj2[field];
        delete obj2[field];
    });
};

// Copy an object by a path ignoring other fields.
export const _copy = (obj, new_obj, path_pieces) => {
    for (var i = 0; i < path_pieces.length - 1; i++) {
        const piece = path_pieces[i];

        obj = obj[piece];

        if (!isObject(obj)) {
            return;
        }

        new_obj[piece] = new obj.constructor();
        new_obj = new_obj[piece];
    }

    if (hasOwnProperty(obj, path_pieces[i])) {
        new_obj[path_pieces[i]] = obj[path_pieces[i]];

        return obj;
    }
};

// Copy an object by specified paths ignoring other paths.
export const copy = (obj, paths) => {
    let new_objs = [];

    for (let path_pieces of paths) {
        const new_obj = new obj.constructor();

        if (_copy(obj, new_obj, path_pieces)) {
            new_objs.push(new_obj);
        }
    }

    return new_objs.reduce((prev, curr) => {
        return deepMerge(prev, curr);
    }, {});
};

export const equal = (value1, value2) => {
    return hashify(value1) === hashify(value2);
};

export const unknownOp = (name) => {
    throw Error(`unknown operator '${name}'`);
};

export const hashify = (value) => {
    if (value === undefined) {
        return;
    }

    return objectHash(value);
};

export const getIDBError = (e) => Error(e.target.error.message);
