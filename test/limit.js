/* global describe before after it*/
import 'fake-indexeddb/auto.js';
import { expect } from 'chai';
import Db from '../src/db.js';

const db = new Db(Math.random(), ['col']);
const col = db.collection('col');

const docs = [
    { x: 4, k: 3 },
    { x: 2, k: 9 },
    { x: 3, k: 8 },
];

before(() => col.insert(docs));
after(() => db.drop());

describe('Limit number of documents', () => {
    it('should limit the number of documents', async () => {
        let docs = await col
            .find()
            .limit(2)
            .toArray();
        expect(docs).to.have.lengthOf(2);
    });
});
