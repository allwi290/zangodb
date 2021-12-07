import { getIDBError } from './util.js';

export default (cur) => {
    return new Promise((resolve, reject) => {
        (function iterate(affectedDocuments) {
            cur._next((error, doc, idb_cur) => {
                if (!doc) {
                    if (error) {
                        return reject(error);
                    } else {
                        return resolve(affectedDocuments);
                    }
                }
                const idb_req = idb_cur.delete();
                idb_req.onsuccess = () => iterate(++affectedDocuments);
                idb_req.onerror = (e) => {
                    return reject(getIDBError(e));
                };
            });
        })(0);
    });
};
