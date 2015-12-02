var app = require('./app/app');
var mongoSettings = require('./app/config/mongodb');
var twitterCredentials = require('./app/config/twitter');

app.start({ mongodb: mongoSettings, twitter: twitterCredentials }, function(err, serverAddress) {
  console.log('Server started at http://%s:%s', serverAddress.address, serverAddress.port);
});