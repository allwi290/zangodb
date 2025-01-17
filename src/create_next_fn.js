import merge from 'deepmerge';
import { hashify, getIDBError } from './util.js';
import filter from './filter.js';
import sort from './sort.js';
import { build, Conjunction, Disjunction, Exists } from './lang/filter.js';

const toIDBDirection = (value) => (value > 0 ? 'next' : 'prev');

const joinPredicates = (preds) => {
    if (preds.length > 1) {
        return new Conjunction(preds);
    }

    return preds[0];
};

const removeClause = ({ parent, index }) => {
    parent.args.splice(index, 1);
};

const openConn = async ({ col, read_pref }) => {
    let idb  = await col._db._getConn();
    const name = col._name;
    const trans = idb.transaction([name], read_pref);
    return trans.objectStore(name);
};

const getIDBReqWithIndex = (store, clause) => {
    const key_range = clause.idb_key_range || null,
        direction = clause.idb_direction || 'next',
        { literal } = clause.path;

    let index;

    if (literal === '_id') {
        index = store;
    } else {
        index = store.index(literal);
    }

    return index.openCursor(key_range, direction);
};

const getIDBReqWithoutIndex = (store) => store.openCursor();

const buildPredicates = (pipeline) => {
    const new_pipeline = [];

    for (let [fn, arg] of pipeline) {
        if (fn === filter) {
            const pred = build(arg);

            if (pred === false) {
                return;
            }
            if (!pred) {
                continue;
            }

            arg = pred;
        }

        new_pipeline.push([fn, arg]);
    }

    return new_pipeline;
};

const initPredAndSortSpec = (config) => {
    const { pipeline } = config,
        preds = [],
        sort_specs = [];

    let i = 0;

    for (let [fn, arg] of pipeline) {
        if (fn === sort) {
            sort_specs.push(arg);
        } else if (fn === filter) {
            preds.push(arg);
        } else {
            break;
        }

        i++;
    }

    pipeline.splice(0, i);

    config.pred = joinPredicates(preds);

    if (sort_specs.length) {
        config.sort_spec = sort_specs.reduce(merge, {});
    }
};

const getClauses = (col, pred) => {
    if (!pred) {
        return [];
    }

    const clauses = [],
        exists_clauses = [];

    for (let clause of pred.getClauses()) {
        if (col._isIndexed(clause.path.literal)) {
            if (clause instanceof Exists) {
                exists_clauses.push(clause);
            } else {
                clauses.push(clause);
            }
        }
    }

    if (clauses.length) {
        return clauses;
    }

    return exists_clauses;
};

const initClauses = (config) => {
    const { col, pred } = config;

    config.clauses = getClauses(col, pred);
};

const initHint = (config) => {
    if (!config.hint) {
        return;
    }

    const { clauses, hint } = config;

    let new_clauses = [];

    for (let clause of clauses) {
        if (clause.path.literal === hint) {
            new_clauses.push(clause);
        }
    }

    if (!new_clauses.length) {
        new_clauses = [{ path: { literal: hint } }];
    }

    config.clauses = new_clauses;
};

const initSort = (config) => {
    if (!config.sort_spec) {
        return;
    }

    const { clauses, sort_spec: spec, pipeline } = config;
    const new_clauses = [];

    for (let clause of clauses) {
        const { literal } = clause.path;
        if (!Object.prototype.hasOwnProperty.call(spec, literal)) {
            continue;
        }

        const order = spec[literal];
        clause.idb_direction = toIDBDirection(order);

        new_clauses.push(clause);
    }

    if (new_clauses.length) {
        config.clauses = new_clauses;
    } else {
        pipeline.unshift([sort, spec]);
    }
};

const createGetIDBReqFn = ({ pred, clauses, pipeline }) => {
    let getIDBReq;

    if (clauses.length) {
        const clause = clauses[0];

        getIDBReq = (store) => getIDBReqWithIndex(store, clause);

        if (!pred || clause === pred) {
            return getIDBReq;
        }

        removeClause(clause);
    } else {
        getIDBReq = getIDBReqWithoutIndex;

        if (!pred) {
            return getIDBReq;
        }
    }

    pipeline.unshift([filter, pred]);

    return getIDBReq;
};

const createGetIDBCurFn = (config) => {
    let idb_cur, idb_req;

    const getIDBReq = createGetIDBReqFn(config);

    const onIDBCur = () => {
        return new Promise((resolve, reject) => {
            idb_req.onsuccess = (e) => {
                return resolve(e.target.result); //idb_cur
            };

            idb_req.onerror = (e) => {
                return reject(getIDBError(e));
            };
        });
    };

    const progressCur = async () => {
        let cursorPromise = onIDBCur();
        idb_cur.continue();
        idb_cur = await cursorPromise;
        return idb_cur;
    };

    let getCur = async () => {
        let store = await openConn(config);
        idb_req = getIDBReq(store);
        idb_cur = await onIDBCur();
        return idb_cur;
    };

    return async () => {
        if (idb_cur) {
            return await progressCur();
        } else {
            return await getCur();
        }
    };
};

const addPipelineStages = ({ pipeline }, next) => {
    for (let [fn, arg] of pipeline) {
        next = fn(next, arg);
    }

    return next;
};

const createParallelNextFn = (config) => {
    const next_fns = [],
        pred_args = config.pred.args;

    for (let i = pred_args.length - 1; i >= 0; i--) {
        const new_config = {
            col: config.col,
            read_pref: config.read_pref,
            pred: pred_args[i],
            pipeline: [],
        };

        initClauses(new_config);

        const next = createNextFn(new_config);

        next_fns.push(addPipelineStages(new_config, next));
    }

    const _id_hashes = new Set();

    const onDoc = (doc) => {
        const _id_hash = hashify(doc._id);

        if (!_id_hashes.has(_id_hash)) {
            return _id_hashes.add(_id_hash);
        }
    };

    const getNextFn = () => next_fns.pop();

    let currentNextFn = getNextFn();

    const changeNextFn = async () => {
        if ((currentNextFn = getNextFn())) {
            return await next();
        } else {
            return;
        }
    };

    const next = async () => {
        let idb_cur = await currentNextFn();
        if (idb_cur) {
            if (onDoc(idb_cur.value)) {
                return idb_cur;
            } else {
                return await next();
            }
        } else {
            return await changeNextFn();
        }
    };

    const spec = config.sort_spec;
    if (spec) {
        config.pipeline.push([sort, spec]);
    }

    return next;
};

const createNextFn = (config) => {
    const getIDBCur = createGetIDBCurFn(config);
    async function next() {
        return await getIDBCur(); // idb_cur.value, idb_cur
    }
    return next;
};

export default (cur) => {
    let pipeline;

    try {
        pipeline = buildPredicates(cur.pipeline);
    } catch (error) {
        return (cb) => cb(error);
    }

    if (!pipeline) {
        return (cb) => cb();
    }

    const config = {
        col: cur.col,
        read_pref: cur.read_pref,
        hint: cur._hint,
        pipeline,
    };

    initPredAndSortSpec(config);

    let next;

    if (config.pred instanceof Disjunction) {
        next = createParallelNextFn(config);
    } else {
        initClauses(config);
        initHint(config);
        initSort(config);

        next = createNextFn(config);
    }

    return addPipelineStages(config, next);
};
