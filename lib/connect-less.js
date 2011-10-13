// ***Connect-less*** is a simple `less` middleware for Connect.
// It's based upon the old compiler middleware included in Connect <1.7.

// ### Main documentation
// Module dependencies
var fs = require('fs')
  , less = require('less')
  , path = require('path')
  , urlParse = require('url').parse
  , async = require('async');

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
  // * **debug**: print lots of messages to the console
  // * **force**: force updating `.css` files on every request
  var srcDir = path.normalize(options.src || process.cwd())
    , dstDir = path.normalize(options.dst || srcDir)
    , dstRoot = path.normalize(options.dstRoot || dstDir)
    , dstSub = new RegExp('^' + dstDir.replace(dstRoot, ''))
    , compress = options.compress || false
    , debug = options.debug || false
    , force = options.force || false
    , dependencies = {};

  // Middleware
  return function (req, res, next) {
    if ('GET' != req.method) return next();
    var pathname = urlParse(req.url).pathname;
    if (match.test(pathname)) {
      var relPath = pathname.replace(dstSub, '')
        , src = path.join(srcDir, relPath).replace(match, ext)
        , dst = path.join(dstDir, relPath);

      if (debug) log('request', dst + ' -> ' + src + (force ? ' (forced)' : ''));

      var lessOptions = {
        compress: compress,
        paths: [ path.dirname(src) ]
      };

      if (force) return compile(next);

      checkDependencies(src, function(deps) {
        fs.stat(dst, function(err, dstStats) {
          var statFiles = deps.concat(src);
          if (err && 'ENOENT' == err.code) return compile(next);
          if (debug) log('checking files', statFiles.join(' '))
          multiStat(statFiles, function (err, stats) {
            if (err) return next(err);
            for (var i = 0; i < stats.length; i++) {
              if (stats[i].mtime > dstStats.mtime) {
                if (debug) log('modified', src);
                return compile(next);
              }
            }
            next();
          });
        });
      });

      function parse(cb) {
        if (debug) log('reading', src);
        fs.readFile(src, 'utf8', function(err, str) {
          if (err) return cb(err);
          var parser = new less.Parser(lessOptions);
          parser.parse(str, function (e, root) {
            cb(null, root)
          });
        });
      }

      function checkDependencies(src, cb) {
        if (dependencies[src]) return cb(dependencies[src]);
        parse(function(err, root) {
          dependencies[src] = findImports(root).map(function (dep) {
            return path.join(srcDir, dep);
          });
          cb(dependencies[src]);
        });
      }

      function compile(cb) {
        if (debug) log('rendering', dst);
        parse(function (err, root) {
          var str = root.toCSS(lessOptions);
          if (err) return cb(err);
          if (debug) log('rendered', dst);
          fs.writeFile(dst, str, 'utf8', cb);
        })
      }

      // Ignore `file not found` errors
      function error(err) {
        next('ENOENT' == err.code
          ? null
          : err);
      }
    } else {
      next();
    }
  };
}

function findImports(root, files) {
  var rules = root.rules
    , rule;

  if (!files) files = [];
  for (var i = 0; i < rules.length; i++) {
    rule = rules[i];
    if (rule.path && rule.root) {
      files.push(rule.path);
      findImports(rule.root, files);
    }
  }
  return files;
}

function multiStat(files, cb) {
  if (!files.length) cb(null, []);
  var results = [];

  async.forEach(files, function(file, done) {
    fs.stat(file, function (err, stats) {
      if (err) return done(err);
      results.push(stats);
      done(null);
    })
  }, function(err) {
    cb(err, results);
  });
}

// Is there a standard for console debugging messages?
function log(message, arg) {
  console.info('[connect-less] %s: %s', message, arg);
}
