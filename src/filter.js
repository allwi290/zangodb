import { Fields } from './lang/fields.js';

export default (next, pred) => async () => {
    let idb_cur;
    while ((idb_cur = await next())) {
        let doc = idb_cur.value;
        if (pred.run(new Fields(doc))) {
            return idb_cur;
        }
    }
    return;
};
