// ***Connect-less*** is a simple `less` middleware for Connect.
// It's based upon the old compiler middleware included in Connect <1.7.
//
// ### Known issues:
// * it doesn't check for `@import`ed files mtimes

// ### Main documentation
// Module dependencies
var fs = require('fs')
  , less = require('less')
  , path = require('path')
  , parse = require('url').parse;

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
    , force = options.force || false;

  // Middleware
  return function (req, res, next) {
    if ('GET' != req.method) return next();
    var pathname = parse(req.url).pathname;
    if (match.test(pathname)) {
      var relPath = pathname.replace(dstSub, '')
        , src = path.join(srcDir, relPath).replace(match, ext)
        , dst = path.join(dstDir, relPath);

      if (debug) log('request', dst + ' -> ' + src + (force ? ' (forced)' : ''));
      if (force) return compile();

      fs.stat(src, function(err, srcStats) {
        if (err) return error(err);
        fs.stat(dst, function(err, dstStats) {
          if (err && 'ENOENT' == err.code) return compile();
          if (err) return next(err);
          if (srcStats.mtime > dstStats.mtime) {
            if (debug) log('modified', src);
            compile();
          } else {
            next();
          }
        });
      });

      function compile() {
        if (debug) log('reading', src);
        fs.readFile(src, 'utf8', function(err, str) {
          if (err) return next(err);
          if (debug) log('rendering', dst);

          var lessOptions = {
            compress: compress,
            paths: [ path.dirname(src) ]
          };
          less.render(str, lessOptions, function(err, str) {
            if (err) return next(err);
            if (debug) log('rendered', dst);
            fs.writeFile(dst, str, 'utf8', next);
          });
        });
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

// Is there a standard for console debugging messages?
function log(message, arg) {
  console.info('[connect-less] %s: %s', message, arg);
}
