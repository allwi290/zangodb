/* global describe before after it*/
import 'fake-indexeddb/auto.js';
import { expect } from 'chai';
import Db from '../src/db.js';

const db = new Db(Math.random(), { col: ['x'] });
const col = db.collection('col');

const docs = [
    { x: 4, k: 3 },
    { x: 2, k: 9 },
    { x: 3, k: 8 },
];

before(() => col.insert(docs));
after(() => db.drop());

describe('Delete documents', () => {
    it('should delete documents', async () => {
        await col.remove({ x: 4 });
        let docs = await col.find().toArray();
        expect(docs).to.have.lengthOf(2);
        expect(docs).to.not.deep.include({ _id: 1, x: 4, k: 3 });
    });
});
