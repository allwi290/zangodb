export default (_next, num) => {
    let count = 0;

    const next = async () => {
        let idb_cur = await _next();
        if (idb_cur) {
            if (++count > num) {
                let doc = idb_cur.value;
                return doc;
            } else {
                return await next();
            }
        } else {
            Promise.reject(`To few documents, has only skipped ${count}, should skip ${num}`);
        }
    };
    return next;
};
