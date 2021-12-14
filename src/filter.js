import { Fields } from './lang/fields.js';

export default (next, pred) => async () => {
    async function iterate(next, pred) {
        let idb_cur = await next();
        if (idb_cur) {
            let doc = idb_cur.value;
            if (pred.run(new Fields(doc))) {
                return idb_cur;
            } else {
                return await iterate(next, pred);
            }
        } else {
            return;
        }
    }
    return await iterate(next, pred);
};
