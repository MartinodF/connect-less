# connect-less

A simple [less](http://lesscss.org) middleware for Node's [Connect](https://github.com/senchalabs/connect), able to compile your `.less` files on the fly as needed.

## What?!

You just have to plug connect-less to your Connect/Express application to let it manage your `.less` -> `.css` conversions automatically.

## How do I do it?

Use [NPM](http://npmjs.org) to install connect-less

    npm install connect-less

Then load it in your app, specifying the source (and optionally destination) directory

    app.use(require('connect-less')({ src: __dirname + '/public/' }));

## Just that?

Yes, connect-less will take care of everything.

If you want, you can read the [docco](http://jashkenas.github.com/docco)-commented source code with the full description of the available options [here](http://martinodf.github.com/connect-less).
