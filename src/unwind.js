import { toPathPieces, get } from './util.js';

export default (_next, path) => {
    const path_pieces = toPathPieces(path.substring(1)),
        elements = [],
        fn = () => {
            let returnValue = {value: elements.pop()};
            return returnValue.value && returnValue;
        };

    const onDoc = async (doc) => {
        const old_length = elements.length;

        get(doc, path_pieces, (obj, field) => {
            const new_elements = obj[field];
            if (!new_elements) {
                return;
            }

            if (new_elements[Symbol.iterator]) {
                for (let element of new_elements) {
                    elements.push({ [field]: element });
                }
            }
        });

        if (old_length === elements.length) {
            return await next();
        }

        return fn();
    };

    let next = async () => {
        let idb_cur = await _next();
        if (idb_cur) {
            return onDoc(idb_cur.value);
        } else {
            return (next = fn)();
        }
    };

    return async () => {
        return await next();
    };
};
