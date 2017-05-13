'use strict';
const del = require('del');
const gulp = require('gulp');
const $ = require('gulp-load-plugins')();
const cssSlam = require('css-slam').gulp;
const mergeStream = require('merge-stream');
const polymerBuild = require('polymer-build');
const swPrecacheConfig = require('./sw-precache-config.js');
const polymerJson = require('./polymer.json');
const project = new polymerBuild.PolymerProject(polymerJson);
const sourcesHtmlSplitter = new polymerBuild.HtmlSplitter();
const dependenciesHtmlSplitter = new polymerBuild.HtmlSplitter();
const buildDirectory = 'build';
/**
 * Waits for the given ReadableStream
 */
function waitFor(stream) {
  return new Promise((resolve, reject) => {
    stream.on('end', resolve);
    stream.on('error', reject);
  });
}

function build() {
  return new Promise((resolve, reject) => {
    console.log(`Deleting ${buildDirectory} directory...`);
    del([buildDirectory])
      .then(() => {
        let sourcesStream = project.sources()
          .pipe($.plumber())
          .pipe(sourcesHtmlSplitter.split())
          .pipe($.if(/\.js$/, $.babel({presets: ['es2015']})))
          .pipe($.if(/\.js$/, $.uglify()))
          .pipe($.if(/\.html$/, $.htmlAutoprefixer()))
          .pipe($.if(/\.html$/, cssSlam()))
          .pipe($.if(/\.html$/, $.htmlMinifier({ removeComments: true })))
          .pipe($.if(/\.(png|gif|jpg|svg)$/, $.imagemin()))
          .pipe(sourcesHtmlSplitter.rejoin());

        let dependenciesStream = project.dependencies()
          .pipe($.plumber())
          .pipe(dependenciesHtmlSplitter.split())
          .pipe($.if(/\.js$/, $.uglify()))
          .pipe($.if(/\.html$/, $.htmlAutoprefixer()))
          .pipe($.if(/\.html$/, cssSlam()))
          .pipe($.if(/\.html$/, $.htmlMinifier({
            removeComments: true,
            collapseWhitespace: true
          })))
          .pipe(dependenciesHtmlSplitter.rejoin());

        let bundled = mergeStream(sourcesStream, dependenciesStream)
          .pipe(project.bundler())
          .pipe(gulp.dest('build/'));
        return waitFor(bundled);
      })
      .then(() => {
        console.log('Generating the Service Worker...');
        return polymerBuild.addServiceWorker({
          project: project,
          buildRoot: buildDirectory,
          bundled: true,
          swPrecacheConfig: swPrecacheConfig
        });
      })
      .then(() => {
        console.log('Build complete!');
        resolve();
      });
  });
}
gulp.task('build', build);
