import { toPathPieces, isObject, equal, hasOwnProperty } from './util.js';

const compare = (a, b, path_pieces, order) => {
    for (var i = 0; i < path_pieces.length - 1; i++) {
        const piece = path_pieces[i];

        a = a[piece];
        b = b[piece];

        if (!isObject(a)) {
            if (!isObject(b)) {
                return null;
            }
        } else if (isObject(b)) {
            continue;
        }

        return order;
    }

    const piece = path_pieces[i];

    if (!hasOwnProperty(a, piece)) {
        if (!hasOwnProperty(b, piece)) {
            return null;
        }
    } else if (hasOwnProperty(b, piece)) {
        a = a[piece];
        b = b[piece];

        if (equal(a, b)) {
            return 0;
        }

        return (a < b ? 1 : -1) * order;
    }

    return order;
};

export default (_next, spec) => {
    const sorts = [];

    for (let path in spec) {
        sorts.push([toPathPieces(path), spec[path]]);
    }

    const sortFn = (a, b) => {
        for (var [path_pieces, order] of sorts) {
            const result = compare(a.value, b.value, path_pieces, order);

            if (result > 0 || result < 0) {
                return result;
            }
        }

        return -order;
    };

    let docs;

    return async () => {
        if (!docs){
            docs = [];
            let idb_cur;
            while ((idb_cur = await _next())) {
                docs.push({value: idb_cur.value});
            }
            docs = docs.sort(sortFn);
        }
        return docs.pop();
    };
};
