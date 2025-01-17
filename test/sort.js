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

const _sort = (spec) => col.find().sort(spec);

const sort = (cur, expected_docs, done) => {
    cur.toArray()
        .then((docs) => {
            expect(docs).to.have.lengthOf(expected_docs.length);

            for (let doc of docs) {
                delete doc._id;

                expect(expected_docs).to.deep.include(doc);
            }

            done();
        })
        .catch(done);
};

const sortWithIndex = (spec, ...args) => {
    sort(_sort(spec).hint('x'), ...args);
};

const sortWithoutIndex = (spec, ...args) => {
    sort(_sort(spec), ...args);
};
describe('Sorting with and without index', () => {
    it('should sort by ascending using index', (done) => {
        sortWithIndex(
            {
                x: 1,
            },
            [
                { x: 2, k: 9 },
                { x: 3, k: 8 },
                { x: 4, k: 3 },
            ],
            done
        );
    });

    it('should sort by ascending without index', (done) => {
        sortWithoutIndex(
            {
                k: 1,
            },
            [
                { x: 4, k: 3 },
                { x: 3, k: 8 },
                { x: 2, k: 9 },
            ],
            done
        );
    });

    it('should sort by descending using index', (done) => {
        sortWithIndex(
            {
                x: -1,
            },
            [
                { x: 4, k: 3 },
                { x: 3, k: 8 },
                { x: 2, k: 9 },
            ],
            done
        );
    });

    it('should sort by descending without index', (done) => {
        sortWithoutIndex(
            {
                k: -1,
            },
            [
                { x: 2, k: 9 },
                { x: 3, k: 8 },
                { x: 4, k: 3 },
            ],
            done
        );
    });
});
