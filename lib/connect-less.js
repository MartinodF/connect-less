// ***Connect-less*** is a simple `less` middleware for Connect.
// It's based upon the old compiler middleware included in Connect <1.7.
// It checks for @import dependencies (thanks to Rob-ot)

// ### Main documentation
// Module dependencies
var async = require('async')
  , fs = require('fs')
  , less = require('less')
  , path = require('path')
  , url = require('url');

// File extensions
var ext = '.less'
  , match = /\.css$/;

module.exports = function (options) {
  options = options || {};

  // ### Options
  // * **src**: directory with `.less` files
  // * **dst**: directory to store the `.css` files into, defaults to `src`
  // * **dstRoot**: public root, set it if `dstDir` is not your public root
  // * **compress**: minify the `.css` files
  // * **yuicompress**: minify the `.css` files using yahoo compressor
  // * **debug**: print lots of messages to the console
  // * **force**: force updating `.css` files on every request
  var srcDir = path.normalize(options.src || process.cwd())
    , dstDir = path.normalize(options.dst || srcDir)
    , dstRoot = path.normalize(options.dstRoot || dstDir)
    , dstSub = new RegExp('^' + dstDir.replace(dstRoot, ''))
    , compress = options.compress || false
    , yuicompress = options.yuicompress || false
    , debug = options.debug || false
    , force = options.force || false
    , deps = {};

  // Middleware
  return function (req, res, next) {
    if ('GET' !== req.method) return next();
    var pathname = url.parse(req.url).pathname;
    if (!match.test(pathname)) return next();

    var relPath = pathname.replace(dstSub, '')
      , src = path.join(srcDir, relPath).replace(match, ext)
      , dst = path.join(dstDir, relPath);

    if (debug) log('request', dst + ' -> ' + src + (force ? ' (forced)' : ''));
    if (force) return compile();

    fs.stat(src, function (err, srcStats) {
      if (err && 'ENOENT' === err.code) return next();
      if (err) return next(err);
      fs.stat(dst, function (err, dstStats) {
        if (err && 'ENOENT' === err.code) return compile();
        if (err) return next(err);
        if (srcStats.mtime > dstStats.mtime) {
          if (debug) log('modified', src);
          delete deps[src];
          return compile();
        } else {
          statDeps(src, deps, function (err, stats) {
            if (err) return next(err);
            for (var file in stats) {
              if (stats[file].mtime > dstStats.mtime) {
                if (debug) log('modified', file + ' (dependency)');
                delete deps[src];
                return compile();
              }
            }
            if (debug) log('not modified', src);
            next();
          });
        }
      });
    });

    function compile() {
      var opts = { compress: compress, yuicompress: yuicompress, paths: [ path.dirname(src) ]};
      if (debug) log('rendering', dst);
      fs.readFile(src, 'utf8', function (err, str) {
        if (err) return next(err);
        less.render(str, opts, function (err, str) {
          if (err) return next(err);
          if (debug) log('rendered', dst);
          fs.writeFile(dst, str, 'utf8', next);
        });
      });
    }
  };

  function statDeps(file, deps, cb) {
    var dir = path.dirname(file)
      , stats = {};
    findDeps(dir, file, deps, function (err, deps) {
      if (err) cb(err);
      if (!deps.length) return cb(null, {});
      // Stat each file in parallel
      async.forEach(deps, function (file, done) {
        fs.stat(file, function (err, s) {
          if (err) return done(err);
          stats[file] = s;
          done();
        });
      }, function (err) {
        cb(err, stats);
      });
    });
  }

  function findDeps(dir, file, deps, cb) {
    // Dependencies are cached
    if (deps[file]) return cb(null, deps[file]);
    fs.readFile(file, 'utf8', function (err, str) {
      if (err) return cb(err);
      if (debug) log('finding dependencies', file);
      // Parse and extract dependencies recursively
      var parser = new less.Parser({ paths: [ dir ]});
      parser.parse(str, function (err, root) {
        if (err) return cb(err);
        deps[file] = [];
        walkRoot(dir, root, deps[file]);
        return cb(null, deps[file]);
      });
    });
  }

  function walkRoot(dir, root, deps) {
    var file, rule, i = 0;
    for (; i < root.rules.length; i++) {
      rule = root.rules[i];
      if (rule.path && rule.root) {
        if (rule.path.charAt(0) == '/') {
          file = rule.path;
        } else {
          file = path.normalize(dir + '/' + rule.path);
        }
        deps.push(file);
        walkRoot(path.dirname(file), rule.root, deps);
      }
    }
    return deps;
  }
};

// Is there a standard for console debugging messages?
function log(message, arg) {
  console.info('[connect-less] %s: %s', message, arg);
}
