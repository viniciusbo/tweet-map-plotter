var express = require('express');
var mongo = require('mongoskin');
var async = require('async');
var util = require('util');
var bodyParser = require('body-parser');
var supervisor = require('./lib/supervisor/supervisor');
var app = express();
var server, db;

app.set('views', 'app/templates');
app.set('view engine', 'jade');

app.use(express.static('src'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function(req, res) {
  res.render('visualize/map');
});

app.get('/collect', function(req, res) {
  db
    .collection('collectors')
    .find({})
    .toArray(function(err, results) {
      if (err)
        console.error(err);

      res.render('collect/list', { collectors: results });
    });
});

app.post('/collect/new', function(req, res) {
  var now = new Date();
  var collector = {
    keywords: req.body.keywords,
    created_at: now,
    updated_at: now,
    count: 0,
    collection: 'collector.' + Date.now(),
    last_tweet_id: null
  };
  
  db
    .collection('collectors')
    .insert(collector, function(err, result) {
      if (err)
        console.error(err);

      if (result.n > 0)
        supervisor.superviseCollector(result.ops[0]);

      res.redirect('/collect');
    });
});

app.get('/collect/stop/:collectorId', function(req, res) {
  res.redirect('/collect');
});

module.exports = {
  start: function start(settings, cb) {
    async.series({
      db: function connectToDb(cb) {
        var connectionStr = util.format('mongodb://%s:%s@%s:%s/%s', settings.mongodb.user, settings.mongodb.password, settings.mongodb.host, settings.mongodb.port, settings.mongodb.database);
        cb(null, mongo.db(connectionStr, { native_parser: true }));
      },
      serverAddress: function startServer(cb) {
        server = app.listen(8998, function() {
          cb(null, server.address());
        });
      }
    }, function(err, result) {
      db = result.db;
      server = result.server;
      supervisor.start(db, settings.twitter);

      cb(err, result.serverAddress);
    });
  }
};