#!/usr/bin/env node
// ref. parse-server/index.js
// ref. parse-server/bin/parse-server

var express = require('express');
var ParseServer = require('parse-server').ParseServer;
var links = require('docker-links').parseLinks(process.env);
var fs = require('fs');

var databaseUri = process.env.DATABASE_URI || process.env.MONGOLAB_URI;

if (!databaseUri) {
  if (links.mongo) {
    databaseUri = 'mongodb://' + links.mongo.hostname + ':' + links.mongo.port + '/dev';
  }
}

if (!databaseUri) {
  console.log('DATABASE_URI not specified, falling back to localhost.');
}

var facebookAppIds = process.env.FACEBOOK_APP_IDS;

if (facebookAppIds) {
  facebookAppIds = facebookAppIds.split(",");
}

var gcmId = process.env.GCM_ID;
var gcmKey = process.env.GCM_KEY;

var iosPushConfigs = new Array();

var productionBundleId = process.env.PRODUCTION_BUNDLE_ID;
var productionPfx = process.env.PRODUCTION_PFX || '/production-pfx';
if (!fs.lstatSync(productionPfx).isFile()) productionPfx = '';
var productionCert = process.env.PRODUCTION_CERT || '/production-pfx-cert.pem';
if (!fs.lstatSync(productionCert).isFile()) productionCert = '';
var productionKey = process.env.PRODUCTION_KEY || '/production-pfx-key.pem';
if (!fs.lstatSync(productionKey).isFile()) productionKey = '';
var productionPushConfig;
if (productionPfx || (productionCert && productionKey)) {
  productionPushConfig = {
    pfx: productionPfx,
    cert: productionCert,
    key: productionKey,
    bundleId: productionBundleId,
    production: true
  };
  iosPushConfigs.push(productionPushConfig);
}

var devBundleId = process.env.DEV_BUNDLE_ID;
var devPfx = process.env.DEV_PFX || '/dev-pfx';
if (!fs.lstatSync(devPfx).isFile()) devPfx = '';
var devCert = process.env.DEV_CERT || '/dev-pfx-cert.pem';
if (!fs.lstatSync(devCert).isFile()) devCert = '';
var devKey = process.env.DEV_KEY || '/dev-pfx-key.pem';
if (!fs.lstatSync(devKey).isFile()) devKey = '';
var devPushConfig;
if (devPfx || (devCert && devKey)) {
  devPushconfig = {
    pfx: devPfx,
    cert: devCert,
    key: devKey,
    bundleId: devBundleId,
    production: false
  };
  iosPushConfigs.push(devPushconfig);
}

var pushConfig;

if ((gcmId && gcmKey) || productionPushConfig || devPushConfig) {
  pushConfig = {
    android: {
      senderId: gcmId,
      apiKey: gcmKey
    },
    ios: iosPushConfigs
  };
}

var port = process.env.PORT || 1337;
// Serve the Parse API on the /parse URL prefix
var mountPath = process.env.PARSE_MOUNT || '/parse';
var serverURL = process.env.SERVER_URL || 'http://localhost:' + port + mountPath; // Don't forget to change to https if needed

var S3Adapter = require('parse-server').S3Adapter;
var GCSAdapter = require('parse-server').GCSAdapter;
//var FileSystemAdapter = require('parse-server').FileSystemAdapter;
var filesAdapter;

if (process.env.S3_ACCESS_KEY &&
        process.env.S3_SECRET_KEY &&
        process.env.S3_BUCKET) {
    var directAccess = process.env.S3_DIRECT || false;

    filesAdapter = new S3Adapter(
            process.env.S3_ACCESS_KEY,
            process.env.S3_SECRET_KEY,
            process.env.S3_BUCKET,
            {directAccess: directAccess});
} else if (process.env.GCP_PROJECT_ID &&
        process.env.GCP_KEYFILE_PATH &&
        process.env.GCS_BUCKET) {
    var directAccess = process.env.GCS_DIRECT || false;

    filesAdapter = new GCSAdapter(
            process.env.GCP_PROJECT_ID,
            process.env.GCP_KEYFILE_PATH,
            process.env.GCS_BUCKET,
            {directAccess: directAccess});
}

var emailModule = process.env.EMAIL_MODULE;
var verifyUserEmails = process.env.VERIFY_USER_EMAILS === "true" || process.env.VERIFY_USER_EMAILS === "1";
var emailAdapter;
if (!emailModule) {
  verifyUserEmails = false;
} else {
  emailAdapter = {
    module: emailModule,
    options: {
      fromAddress: process.env.EMAIL_FROM,
      domain: process.env.EMAIL_DOMAIN,
      apiKey: process.env.EMAIL_API_KEY
    }
  };
}
console.log(verifyUserEmails);
console.log(emailModule);
console.log(emailAdapter);

var enableAnonymousUsers = process.env.ENABLE_ANON_USERS === "true" || process.env.ENABLE_ANON_USERS === "1";
var allowClientClassCreation = process.env.ALLOW_CLIENT_CLASS_CREATION === "true" || process.env.ALLOW_CLIENT_CLASS_CREATION === "1";

var api = new ParseServer({
  databaseURI: databaseUri || 'mongodb://localhost:27017/dev',
  cloud: process.env.CLOUD_CODE_MAIN || __dirname + '/cloud/main.js',

  appId: process.env.APP_ID || 'myAppId',
  masterKey: process.env.MASTER_KEY, //Add your master key here. Keep it secret!
  serverURL: serverURL,

  collectionPrefix: process.env.COLLECTION_PREFIX,
  clientKey: process.env.CLIENT_KEY,
  restAPIKey: process.env.REST_API_KEY,
  dotNetKey: process.env.DOTNET_KEY,
  javascriptKey: process.env.JAVASCRIPT_KEY,
  dotNetKey: process.env.DOTNET_KEY,
  fileKey: process.env.FILE_KEY,
  filesAdapter: filesAdapter,

  facebookAppIds: facebookAppIds,
  maxUploadSize: process.env.MAX_UPLOAD_SIZE,
  push: pushConfig,
  verifyUserEmails: verifyUserEmails,
  emailAdapter: emailAdapter,
  enableAnonymousUsers: enableAnonymousUsers,
  allowClientClassCreation: allowClientClassCreation,
  //oauth = {},
  appName: process.env.APP_NAME,
  publicServerURL: process.env.PUBLIC_SERVER_URL
  //customPages: process.env.CUSTOM_PAGES || // {
    //invalidLink: undefined,
    //verifyEmailSuccess: undefined,
    //choosePassword: undefined,
    //passwordResetSuccess: undefined
  //}
});

//console.log("appId: " + api.appId);
//console.log("masterKey: " + api.masterKey);
//console.log("cloud: " + api.cloud);
//console.log("databaseURI: " + api.databaseURI);
console.log("appId: " + process.env.APP_ID);
console.log("masterKey: " + process.env.MASTER_KEY);

var app = express();

if (process.env.TRUST_PROXY !== "false") {
  console.log("trusting proxy: " + process.env.TRUST_PROXY);
  app.enable('trust proxy');
}

app.use(mountPath, api);

// Parse Server plays nicely with the rest of your web routes
app.get('/', function(req, res) {
  res.status(200).send('I dream of being a web site.');
});

app.listen(port, function() {
  console.log('docker-parse-server running on ' + serverURL + ' (:' + port + mountPath + ')');
});
