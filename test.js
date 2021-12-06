import 'fake-indexeddb/auto.js';
import Db from './src/db.js';
const db = new Db(Math.random(), ['col']);
const col = db.collection('col');

const docs = [
    { x: 4, k: 2 },
    { x: 4, k: 3 },
];

col.insert(docs);

col.aggregate([
    { $match: { x: 4 } },
    { $match: { k: 2 } },
    { $match: {} },
]).toArray((error, docs) => {
    if (error) {
        throw error;
    }
    delete docs[0]._id;
    //db.drop();
});

