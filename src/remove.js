import { getIDBError } from './util.js';
export default async (cur) => {
    let idb_cur;
    function deleteResult(idb_req) {
        return new Promise((resolve, reject) => {
            idb_req.onsuccess = () => {
                return resolve();
            };
            idb_req.onerror = (e) => {
                return reject(getIDBError(e));
            };
        });
    }
    while ((idb_cur = await cur.next())) {
        const idb_req = idb_cur.delete();
        await deleteResult(idb_req);
    }
    return;
};
