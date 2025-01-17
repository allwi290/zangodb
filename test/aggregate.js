/*global describe it after before*/
import 'fake-indexeddb/auto.js';
import { expect } from 'chai';
import Db from '../src/db.js';
describe('$match', () => {
    const db = new Db(Math.random(), ['col']);
    const col = db.collection('col');

    const docs = [
        { x: 4, k: 2 },
        { x: 4, k: 3 },
    ];

    before(() => {
        col.insert(docs);
    });
    after(() => {
        db.drop();
    });

    it('should match documents', (done) => {
        col.aggregate([
            { $match: { x: 4 } },
            { $match: { k: 2 } },
            { $match: {} },
        ])
            .toArray()
            .then((docs) => {
                expect(docs).to.have.lengthOf(1);

                delete docs[0]._id;
                expect(docs[0]).to.deep.equal({ x: 4, k: 2 });
                done();
            })
            .catch(done);
    });
});
