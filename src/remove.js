import { getIDBError } from './util.js';
export default (cur) => {
    (async function iterate() {
        function deleteResult(idb_req) {
            return new Promise((resolve, reject) => {
                idb_req.onsuccess = async () => {
                    try {
                        return resolve(await iterate());
                    } catch (error) {
                        return reject(error);
                    }
                };
                idb_req.onerror = (e) => {
                    return reject(getIDBError(e));
                };
            });
        }        
        let idb_cur = await cur.next();
        if (idb_cur) {
            const idb_req = idb_cur.delete();
            return await deleteResult(idb_req);
        } else {
            return;
        }
    })();
};
