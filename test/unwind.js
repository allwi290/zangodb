/* global describe before after it*/
import 'fake-indexeddb/auto.js';

import { expect } from 'chai';
import Db from '../src/db.js';
const db = new Db(Math.random(), ['col']);
const col = db.collection('col');

const doc = { elements: [1, 3, 3] };

before(() => col.insert(doc));
after(() => db.drop());
describe('Iterable', () => {
    it('should unwind an iterable', async () => {
        const expected_docs = [
            { elements: 1 },
            { elements: 3 },
            { elements: 3 },
        ];

        let docs = await col.aggregate([{ $unwind: '$elements' }]).toArray();
        expect(docs).to.have.lengthOf(expected_docs.length);

        for (let doc of docs) {
            delete doc._id;

            expect(expected_docs).to.deep.include(doc);
        }
    });
});
