import { series, src, dest } from 'gulp';
import uglify from 'gulp-uglify';
import del from 'del';
import webpackStream from 'webpack-stream';
export function clean() {
    return del([
        'dist/**/*',
        'build/**/*'
    ]);
}
export function build() {
    return src('./src/**/*.js').pipe(uglify()).pipe(dest('build/'));
}
export function dist() {
    return src('./src/index.js').pipe(webpackStream()).pipe(dest('dist/'));
}
export default series(clean, dist);
