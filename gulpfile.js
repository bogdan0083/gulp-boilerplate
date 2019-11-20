/* eslint-disable */

/**
 * Settings
 * Turn on/off build features
 */

var settings = {
  clean: true,
  scripts: true,
  html: true,
  polyfills: false,
  styles: true,
  svgs: true,
  copy: true,
  reload: true,
  sprite: true
};

/**
 * Paths to project folders
 */

var paths = {
  input: "src/",
  output: "dist/",
  scripts: {
    input: "src/js/*",
    polyfills: ".polyfill.js",
    output: "dist/js/"
  },
  html: {
    input: "src/pug/*.pug",
    watch: "src/pug/**/*.pug",
    output: "dist/"
  },
  styles: {
    input: "src/sass/**/*.{scss,sass}",
    output: "dist/css/"
  },
  svgs: {
    input: "src/img/svg/*.svg",
    output: "dist/img/svg/"
  },
  images: {
    input: ["!src/img/sprite", "src/img/**/*"],
    output: "dist/img/"
  },
  sprite: {
    input: "src/img/sprite/*",
    output: "src/img/",
    outputScss: "src/sass/mixins"
  },
  copy: {
    input: "src/copy/**/*",
    output: "dist/"
  },
  reload: "./dist/"
};

/**
 * Gulp Packages
 */

// General
var { gulp, src, dest, watch, series, parallel } = require("gulp");
var del = require("del");
var flatmap = require("gulp-flatmap");
var lazypipe = require("lazypipe");
var rename = require("gulp-rename");
var header = require("gulp-header");
var package = require("./package.json");

// Scripts
var jshint = require("gulp-jshint");
var stylish = require("jshint-stylish");
var concat = require("gulp-concat");
var uglify = require("gulp-terser");
var optimizejs = require("gulp-optimize-js");

// Styles
var sass = require("gulp-sass");
var postcss = require("gulp-postcss");
var prefix = require("autoprefixer");
var cssnano = require("cssnano");

// Images
var spritesmith = require("gulp.spritesmith");
var imagemin = require("gulp-imagemin");
var merge = require("merge-stream");
var cache = require("gulp-cache");
var imageminPngquant = require("imagemin-pngquant");
var imageminZopfli = require("imagemin-zopfli");
var imageminMozjpeg = require("imagemin-mozjpeg"); 
var imageminGiflossy = require("imagemin-giflossy");

// SVGs
var svgmin = require("gulp-svgmin");

// BrowserSync
var browserSync = require("browser-sync");

// Pug.js
var pug = require("gulp-pug");

// Prettifier
var prettify = require("gulp-prettify");

// HTMLHint
var htmlhint =  require("gulp-htmlhint");

/**
 * Gulp Tasks
 */

// Remove pre-existing content from output folders
var cleanDist = function(done) {
  // Make sure this feature is activated before running
  if (!settings.clean) return done();

  // clear all the cache for our image optimizations
  cache.clearAll();

  // Clean the dist folder
  del.sync([paths.output]);

  // Signal completion
  return done();
};

// Repeated JavaScript tasks
var jsTasks = lazypipe().pipe(
  dest,
  paths.scripts.output
);

// Lint, minify, and concatenate scripts
var buildScripts = function(done) {
  // Make sure this feature is activated before running
  if (!settings.scripts) return done();

  // Run tasks on script files
  return src(paths.scripts.input).pipe(
    flatmap(function(stream, file) {
      // If the file is a directory
      if (file.isDirectory()) {
        // Setup a suffix variable
        var suffix = "";

        // If separate polyfill files enabled
        if (settings.polyfills) {
          // Update the suffix
          suffix = ".polyfills";

          // Grab files that aren't polyfills, concatenate them, and process them
          src([
            file.path + "/*.js",
            "!" + file.path + "/*" + paths.scripts.polyfills
          ])
            .pipe(concat(file.relative + ".js"))
            .pipe(jsTasks());
        }

        // Grab all files and concatenate them
        // If separate polyfills enabled, this will have .polyfills in the filename
        src(file.path + "/*.js")
          .pipe(concat(file.relative + suffix + ".js"))
          .pipe(rename({ suffix: ".min" }))
          .pipe(jsTasks());

        return stream;
      }

      // Otherwise, process the file
      return stream.pipe(jsTasks());
    })
  );
};

// Lint scripts
var lintScripts = function(done) {
  // Make sure this feature is activated before running
  if (!settings.scripts) return done();

  // Lint scripts
  return src(paths.scripts.input)
    .pipe(jshint())
    .pipe(jshint.reporter("jshint-stylish"));
};

// Build HTML
var buildHtml = function(done) {
  // Make sure this feature is activated before running
  if (!settings.html) return done();

  // Lint scripts
  return src(paths.html.input)
    .pipe(pug())
    .pipe(prettify({
      indent_size: 2,
      wrap_attributes: 'auto', // 'force'
      preserve_newlines: true,
      // unformatted: [],
      end_with_newline: true
    }))
    .pipe(htmlhint('.htmlhintrc'))
    .pipe(htmlhint.reporter())
    .pipe(dest(paths.html.output));
};

// Process, lint, and minify Sass files
var buildStyles = function(done) {
  const gulpStylelint = require("gulp-stylelint");

  // Make sure this feature is activated before running
  if (!settings.styles) return done();

  // Run tasks on all Sass files
  return src(paths.styles.input)
    .pipe(
      gulpStylelint({
        fix: true,
        failAfterError: false,
        syntax: "scss",
        reporters: [{ formatter: "string", console: true }]
      })
    )
    .pipe(
      sass({
        outputStyle: "expanded",
        sourceComments: false,
        includePaths: ["node_modules"]
      })
    )
    .pipe(
      postcss([
        cssnano({
          preset: [
            "default",
            {
              rawCache: false,
              normalizeWhitespace: false
            }
          ]
        })
      ])
    )
    .pipe(dest(paths.styles.output));
};

// Optimize SVG files
var buildSVGs = function(done) {
  // Make sure this feature is activated before running
  if (!settings.svgs) return done();

  // Optimize SVG files
  return src(paths.svgs.input)
    .pipe(svgmin())
    .pipe(dest(paths.svgs.output));
};

// Optimize images
var buildImages = function() {
  return src(paths.images.input)
    .pipe(
      cache(
        imagemin([
          imageminPngquant({
            speed: 1,
            quality: [0.95, 1] //lossy settings
          }),
          imageminZopfli({
            more: true
            // iterations: 50 // very slow but more effective
          }),
          //gif very light lossy, use only one of gifsicle or Giflossy
          imageminGiflossy({
            optimizationLevel: 3,
            optimize: 3, //keep-empty: Preserve empty transparent frames
            lossy: 2
          }),
          //svg
          imagemin.svgo({
            plugins: [
              {
                removeViewBox: false
              }
            ]
          }),
          //jpg lossless
          imagemin.jpegtran({
            progressive: true
          }),
          //jpg very light lossy, use vs jpegtran
          imageminMozjpeg({
            quality: 90
          })
        ], { verbose: true })
      )
    )
    .pipe(dest(paths.images.output));
};

var buildSprites = function(done) {
  // Generate our spritesheet
  var spriteData = src(paths.sprite.input).pipe(
    spritesmith({
      imgName: "sprite.png",
      cssName: "_sprite.scss",
      padding: 10
    })
  );

  // Pipe image stream through image optimizer and onto disk
  var imgStream = spriteData.img.pipe(dest(paths.sprite.output));

  // Pipe CSS stream through CSS optimizer and onto disk
  var cssStream = spriteData.css.pipe(dest(paths.sprite.outputScss));

  // Return a merged stream to handle both `end` events
  return merge(imgStream, cssStream);
};

// Copy static files into output folder
var copyFiles = function(done) {
  // Make sure this feature is activated before running
  if (!settings.copy) return done();

  // Copy static files
  return src(paths.copy.input).pipe(dest(paths.copy.output));
};

// Watch for changes to the src directory
var startServer = function(done) {
  // Make sure this feature is activated before running
  if (!settings.reload) return done();

  // Initialize BrowserSync
  browserSync.init({
    server: {
      baseDir: paths.reload
    }
  });

  // Signal completion
  done();
};

// Reload the browser when files change
var reloadBrowser = function(done) {
  if (!settings.reload) return done();
  browserSync.reload();
  done();
};

// Watch for changes
var watchSource = function(done) {
  watch(paths.scripts.input, series(buildScripts, reloadBrowser));
  watch(paths.html.watch, series(buildHtml, reloadBrowser));
  watch(paths.styles.input, series(buildStyles, reloadBrowser));
  watch(paths.svgs.input, series(buildSVGs, reloadBrowser));
  watch(paths.images.input, series(buildImages, reloadBrowser));
  watch(paths.sprite.input, series(buildSprites, reloadBrowser));
  watch(paths.copy.input, series(copyFiles, reloadBrowser));
  done();
};

/**
 * Export Tasks
 */

// Default task
// gulp
exports.default = series(
  cleanDist,
  parallel(
    series(buildSprites, buildSVGs, buildImages),
    buildScripts,
    buildHtml,
    lintScripts,
    buildStyles,
    copyFiles
  )
);

// Watch and reload
// gulp watch
exports.watch = series(exports.default, startServer, watchSource);
