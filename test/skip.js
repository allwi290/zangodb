/* global describe before after it*/
import 'fake-indexeddb/auto.js';
import { expect } from 'chai';
import Db from '../src/db.js';
const db = new Db(Math.random(), ['col']);
const col = db.collection('col');

const docs = [
    { x: 4, k: 3 },
    { x: 2, k: 9 },
    { x: 3, k: 8 }
];

before(() => col.insert(docs));
after(() => db.drop());
describe('Skip documents', () =>{
    it('should skip a specified number of documents', async () => {
        let docs =  await col.find().skip(2).toArray();
        expect(docs).to.have.lengthOf(1);
    });    
});
