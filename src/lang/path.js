import { toPathPieces } from '../util.js';

export class Path {
    constructor(path) {
        this.pieces = toPathPieces(path);
        this.literal = path;
    }
}
