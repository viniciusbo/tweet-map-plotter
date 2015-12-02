var TweetCollector = require('tweet-collector');
var async = require('async');

var supervisor = {
  db: null,
  twitterCredentials: null,
  collectors: {},

  start: function(db, twitterCredentials) {
    console.log('Starting collector supervisor...');

    this.db = db;
    this.twitterCredentials = twitterCredentials;
    this._startCollectors();
  },

  _startCollectors: function() {
    console.log('Starting collectors...');

    var self = this;

    this.db
      .collection('collectors')
      .find({ status: { $eq: 1 } })
      .toArray(function(err, results) {
        results.forEach(function(result) {
          self.addCollector(result);
        });
      });
  },

  addCollector: function(collectorData) {
    if (!!this.collectors[collectorData._id])
      return console.log('Collector already being supervised');

    var collector = new TweetCollector(this.twitterCredentials);
    collector.start({
      q: collectorData.keywords,
      since_id: collectorData.last_tweet_id
    });
    collector.on('fetch', this._onCollectorFetch.bind(this, collectorData))
    this.collectors[collectorData._id] = collector;

    console.log('Supervising new collector');
  },

  _onCollectorFetch: function(collectorData, tweets) {
    console.log('A collector has fetched some data');

    var self = this;

    if (tweets.length == 0)
      return;

    async.waterfall([
      function persistTweets(cb) {
        return self._persistTweetsToCollection(tweets, collectorData.collection, function(err, result) {
          if (err)
            return cb(err);

          cb(null);
        });
      },
      function updateCollector(cb) {
        var lastTweetId = tweets[tweets.length - 1].id_str;
        var collectorUpdate = {
          $inc: {
            count: tweets.length,
          },
          $set: {
            updated_at: new Date(),
            last_tweet_id: lastTweetId
          }
        };

        self.db
          .collection('collectors')
          .updateOne({ _id: collectorData._id }, collectorUpdate, function(err, result) {
            if (err)
              return cb(err);

            cb(null, result);
          });
      }
    ], function(err, result) {
      if (err)
        return console.error(err);

      console.log('Collector updated');
    });
  },

  _persistTweetsToCollection: function(tweets, collectionName, cb) {
    this.db
      .collection(collectionName)
      .insertMany(tweets, cb);
  },

  resumeCollector: function(collectorData) {
    var collector = this.collectors[collectorData._id];
    if (!collector || collector.status == 'started')
      return;

    collector.start({
      q: collectorData.keywords,
      since_id: collectorData.last_tweet_id
    });
  },

  stopCollector: function(collectorId) {
    var collector = this.collectors[collectorId];
    if (collector)
      collector.stop();
  },

  removeCollector: function(collector) {
    this.stopCollector(collector._id);
    delete this.collectors[collector._id];
    this.db.collection(collector.collection).drop();
  }
};

module.exports = supervisor;