// @TODO: "list pages" task from generator-man repo.

/* eslint-disable */

/**
 * Settings
 * Turn on/off build features
 */

var settings = {
  clean: true,
  scripts: true,
  html: true,
  validateHtml: true,
  polyfills: false,
  styles: true,
  svgSprites: true,
  copy: true,
  reload: true,
  sprite: false
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
    input: "src/templates/**/*.html",
    templatesDir: "src/templates/",
    watch: "src/templates/**/*.html",
    output: "dist/",
  },
  styles: {
    input: "src/sass/**/*.{scss,sass}",
    output: "dist/css/"
  },
  svgSprites: {
    input: "src/icons/*.svg",
    output: "dist/img/"
  },
  images: {
    input: ["!src/img/icons", "src/img/**/*"],
    output: "dist/img/"
  },
  sprite: {
    input: "src/img/icons/*.{jpg,png,gif}",
    output: "src/img/",
    outputScss: "src/sass/mixins"
  },
  copy: {
    input: "src/copy/**/*",
    output: "dist/"
  },
  svgo: {
    input: "src/svgo/input/*.svg",
    output: "src/svgo/output/",
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
var path = require("path");
var plumber = require("gulp-plumber");

// Scripts
var jshint = require("gulp-jshint");
var stylish = require("jshint-stylish");
var concat = require("gulp-concat");
var uglify = require("gulp-terser");
var optimizejs = require("gulp-optimize-js");
var useref = require("gulp-useref");

// Styles
var sass = require('gulp-sass')(require('sass'));
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
var svgStore = require("gulp-svgstore");
var cheerio = require('cheerio');
var gulpcheerio = require('gulp-cheerio');
var through2 = require('through2');
var consolidate = require('gulp-consolidate');

// BrowserSync
var browserSync = require("browser-sync");

// html validator
var validator = require("gulp-html");

// Nunjucks template engine
var changed = require("gulp-changed");
var gulpif = require("gulp-if");
var frontMatter = require("gulp-front-matter");
var nunjucksRender = require("gulp-nunjucks-render");

// Prettifier
var prettify = require("gulp-prettify");

// HTMLHint
var htmlhint = require("gulp-htmlhint");

var fs = require("fs");
const gulpTemplate = require("gulp-template");

/**
 * Gulp Tasks
 */

// Remove pre-existing content from output folders
var cleanDist = function (done) {
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
var buildScripts = function (done) {
  // Make sure this feature is activated before running
  if (!settings.scripts) return done();

  // Run tasks on script files
  return src(paths.scripts.input).pipe(
    flatmap(function (stream, file) {
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
var lintScripts = function (done) {
  // Make sure this feature is activated before running
  if (!settings.scripts) return done();

  // Lint scripts
  return src(paths.scripts.input)
    .pipe(jshint())
    .pipe(jshint.reporter("jshint-stylish"));
};

var getPagesData = path => {
  let htmlFiles = fs.readdirSync(path).filter(f => f.includes('.html'))
  let pagesData = htmlFiles.map(f => {
    let fileContentsStr = fs.readFileSync(path + f).toString()
    let title = fileContentsStr.match(/title:\s?(?<title>.*)\n/).groups.title
    return { filePath: f, title }
  })

  return pagesData
}

// Build HTML
var buildPagesList = function () {
  var data = getPagesData('src/templates/')
  return src('src/index.html')
    .pipe(gulpTemplate({ data }))
    .pipe(dest(paths.html.output))
}

var buildHtml = function (done) {
  // Make sure this feature is activated before running
  if (!settings.html) return done();

  nunjucksRender.nunjucks.configure({
    watch: false,
    trimBlocks: true,
    lstripBlocks: false
  });

  // Lint scripts
  return src(paths.html.input)
    .pipe(plumber())
    .pipe(frontMatter({ property: 'data' }))
    .pipe(nunjucksRender({
      path: [paths.html.templatesDir]
    }))
    .pipe(useref({ searchPath: __dirname }))
    .pipe(dest(paths.html.output));
};

var validateHtml = function (done) {
  if (!settings.validateHtml) return done();

  return src(paths.html.output + '*.html')
    .pipe(plumber())
    .pipe(validator());
};

// Process, lint, and minify Sass files
var buildStyles = function (done) {
  // const gulpStylelint = require("gulp-stylelint");

  // Make sure this feature is activated before running
  if (!settings.styles) return done();

  // Run tasks on all Sass files
  return src(paths.styles.input)
    // .pipe(
    //   gulpStylelint({
    //     fix: true,
    //     failAfterError: false,
    //     syntax: "scss",
    //     reporters: [{formatter: "string", console: true}]
    //   })
    // )
    .pipe(
      sass({
        outputStyle: "expanded",
        sourceComments: false,
        includePaths: ["node_modules"],
        importer: (url) => {
          if (url && url[0] === '~') {
            url = path.resolve('node_modules', url.substr(1));
          }
          return { file: url };
        }
      })
    )
    // .pipe(
    //   postcss([
    //     prefix(),
    //     cssnano({
    //       preset: [
    //         "default",
    //         {
    //           rawCache: false,
    //           normalizeWhitespace: false
    //         }
    //       ]
    //     }),
    //     require('postcss-sort-media-queries')({
    //       // sort: 'mobile-first' default value
    //       sort: 'mobile-first'
    //     }),
    //   ])
    // )
    .pipe(dest(paths.styles.output));
};

// Optimize SVG files
var buildSvgSprites = function (done) {
  // Make sure this feature is activated before running
  if (!settings.svgSprites) return done();

  // Optimize SVG files
  return src(paths.svgSprites.input)
    .pipe(
      gulpcheerio({
        run: function ($, file) {

          // $('[fill]:not([fill="currentColor"])').removeAttr('fill');
          // $('[stroke]').removeAttr('stroke');
          let w, h, size;
          if ($('svg').attr('height')) {
            w = $('svg').attr('width').replace(/\D/g, '');
            h = $('svg').attr('height').replace(/\D/g, '');
          } else {
            size = $('svg').attr('viewbox').split(' ').splice(2);
            w = size[0];
            h = size[1];
            $('svg').attr('width', parseInt(w));
            $('svg').attr('height', parseInt(h));
          }
          $('svg').attr('viewBox', '0 0 ' + parseInt(w) + ' ' + parseInt(h));

        },
        parserOptions: { xmlMode: true }
      })
    )
    .pipe(plumber())
    .pipe(svgmin({
      js2svg: {
        pretty: true
      },
      plugins: [{
        removeDesc: true
      }, {
        cleanupIDs: true
      }, {
        removeViewBox: false
      }, {
        mergePaths: true
      }, { convertColors: { currentColor: true } }]
    }))
    .pipe(rename({ prefix: 'icon-' }))
    .pipe(svgStore({ inlineSvg: false }))
    .pipe(through2.obj(function (file, encoding, cb) {
      let $ = cheerio.load(file.contents.toString(), { xmlMode: true });
      let data = $('svg > symbol').map(function () {
        let $this = $(this);
        let size = $this.attr('viewBox').split(' ').splice(2);
        let name = $this.attr('id');
        let ratio = size[0] / size[1]; // symbol width / symbol height
        let fill = $this.find('[fill]:not([fill="currentColor"])').attr('fill');
        let stroke = $this.find('[stroke]').attr('stroke');

        return {
          name: name,
          ratio: +ratio.toFixed(2),
          width: size[0],
          height: size[1]
          // fill: 'currentColor',
          // stroke: 'currentColor'
        };
      }).get();
      this.push(file);
      src('src/svg-sprite/_svg-sprite.scss')
        .pipe(consolidate('lodash', {
          symbols: data
        }))
        .pipe(dest(paths.input + 'sass/generated'));
      cb();
    }))
    .pipe(rename({ basename: 'sprite' }))
    .pipe(dest(paths.svgSprites.output));
};

var svgo = function () {
  return src(paths.svgo.input)
    .pipe(
      svgmin({
        js2svg: {
          pretty: true
        },
        plugins: [{
          removeDesc: true
        }, {
          cleanupIDs: true
        }, {
          removeViewBox: false
        }, {
          mergePaths: true
        }]
      })
    )
    .pipe(dest(paths.svgo.output));
}

// Optimize images
var buildImages = function () {
  return src(paths.images.input)
    // .pipe(
    //   cache(
    //     imagemin([
    //       imageminPngquant({
    //         speed: 1,
    //         quality: [0.95, 1] //lossy settings
    //       }),
    //       imageminZopfli({
    //         more: true
    //         // iterations: 50 // very slow but more effective
    //       }),
    //       //gif very light lossy, use only one of gifsicle or Giflossy
    //       imageminGiflossy({
    //         optimizationLevel: 3,
    //         optimize: 3, //keep-empty: Preserve empty transparent frames
    //         lossy: 2
    //       }),
    //       //svg
    //       //jpg lossless
    //       imagemin.jpegtran({
    //         progressive: true
    //       }),
    //       //jpg very light lossy, use vs jpegtran
    //       imageminMozjpeg({
    //         quality: 90
    //       })
    //     ], {verbose: true})
    //   )
    // )
    .pipe(dest(paths.images.output));
};

var buildSprites = function (done) {
  // Generate our spritesheet
  var spriteData = src(paths.sprite.input).pipe(
    spritesmith({
      imgName: "icons.png",
      retinaSrcFilter: ['src/img/icons/*@2x.png'],
      cssName: "_sprite.scss",
      padding: 10,
      imgPath: "../img/icons.png",
      retinaImgName: 'sprite@2x.png'
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
var copyFiles = function (done) {
  // Make sure this feature is activated before running
  if (!settings.copy) return done();

  // Copy static files
  return src(paths.copy.input).pipe(dest(paths.copy.output));
};

// Watch for changes to the src directory
var startServer = function (done) {
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
var reloadBrowser = function (done) {
  if (!settings.reload) return done();
  browserSync.reload();
  done();
};

// Watch for changes
var watchSource = function (done) {
  watch(paths.scripts.input, series(buildScripts, reloadBrowser));
  watch(paths.html.watch, series(buildHtml, reloadBrowser));
  watch(paths.svgo.input, series(svgo, buildHtml, reloadBrowser));
  watch(paths.styles.input, series(buildStyles, reloadBrowser));
  watch(paths.svgSprites.input, series(buildSvgSprites, reloadBrowser));
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
    series(buildSvgSprites, buildImages),
    buildScripts,
    series(svgo, buildHtml, buildPagesList, validateHtml),
    lintScripts,
    buildStyles,
    copyFiles
  )
);

// Watch and reload
// gulp watch
exports.watch = series(exports.default, startServer, watchSource);
