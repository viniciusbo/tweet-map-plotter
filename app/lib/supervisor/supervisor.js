var TweetCollector = require('tweet-collector');
var async = require('async');

var supervisor = {
  db: null,
  twitterCredentials: null,

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
      .find({})
      .toArray(function(err, results) {
        results.forEach(function(result) {
          self.superviseCollector(result);
        });
      });
  },

  superviseCollector: function(collectorData) {
    console.log('Supervising new collector');

    var collector = new TweetCollector(this.twitterCredentials);
    collector.start({
      q: collectorData.keywords,
      since_id: collectorData.last_tweet_id
    });
    collector.on('fetch', this._onCollectorFetch.bind(this, collectorData))
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
  }
};

module.exports = supervisor;