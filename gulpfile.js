/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
'use strict';
const del = require('del');
const gulp = require('gulp');
const gulpif = require('gulp-if');
const uglify = require('gulp-uglify');
const babel = require('gulp-babel');
const imagemin = require('gulp-imagemin');
const htmlmin = require('gulp-html-minifier');
const cssSlam = require('css-slam').gulp;
const autoprefixer = require('gulp-html-autoprefixer');
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
          .pipe(sourcesHtmlSplitter.split())
          .pipe(gulpif(/\.js$/, babel({
            presets: ['es2015']
          })))
          .pipe(gulpif(/\.js$/, uglify()))
          .pipe(gulpif(/\.html$/, autoprefixer()))
          .pipe(gulpif(/\.html$/, cssSlam()))
          .pipe(gulpif(/\.html$/, htmlmin({ removeComments: true })))
          .pipe(gulpif(/\.(png|gif|jpg|svg)$/, imagemin()))
          .pipe(sourcesHtmlSplitter.rejoin());
        let dependenciesStream = project.dependencies()
          .pipe(dependenciesHtmlSplitter.split())
          .pipe(gulpif(/\.js$/, uglify()))
          .pipe(gulpif(/\.html$/, autoprefixer()))
          .pipe(gulpif(/\.html$/, cssSlam()))
          .pipe(gulpif(/\.html$/, htmlmin({ removeComments: true })))
          .pipe(dependenciesHtmlSplitter.rejoin());
        let bundled = mergeStream(sourcesStream, dependenciesStream)
          .pipe(project.bundler)
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
