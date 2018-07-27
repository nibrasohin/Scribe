/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


const express = require('express');
const request = require('request-promise');
const https = require('https');

const app = express();
const watson = require('watson-developer-cloud');

const bodyParser = require('body-parser');

const NaturalLanguageUnderstandingV1 = require('watson-developer-cloud/natural-language-understanding/v1.js');

// Bootstrap application settings
require('./config/express')(app);

app.use(bodyParser.json());

const stt = new watson.SpeechToTextV1({
  // if left undefined, username and password to fall back to the SPEECH_TO_TEXT_USERNAME and
  // SPEECH_TO_TEXT_PASSWORD environment properties, and then to VCAP_SERVICES (on Bluemix)
  username: "8cf20155-751b-44ed-8867-33fd3ccc4891",
  password: "6sN1Z5N0cAv5"
});


const authService = new watson.AuthorizationV1(stt.getCredentials());

app.get('/', (req, res) => {
  var utc = new Date().toJSON().slice(0, 10).replace(/-/g, '/');
  console.log(utc);
  res.render('index', {
    bluemixAnalytics: !!process.env.BLUEMIX_ANALYTICS,
  });
});

// Get token using your credentials
app.get('/api/token', (req, res, next) => {
  authService.getToken((err, token) => {
    if (err) {
      next(err);
    } else {
      res.send(token);
    }
  });
});


function callAPI(script) {
  const options = {
    hostname: 'hooks.slack.com',
    path: '/services/TBQ1W9PHV/BBPEB98QG/nMBus91S9LWhypUDkT2Z2cYZ',
    method: 'POST',
  };

  const payload1 = {
    text: script
  };

  const req = https.request(options, (res, b, c) => {
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
    });
  });

  req.write(JSON.stringify(payload1));
  req.end();
}


function groupSpeakerConvo(speech) {
  var dict = {};
  var tempArray = speech.split('\n');
  tempArray.pop();
  for (var i = 0; i < tempArray.length; i++) {
    var split = tempArray[i].split(':');
    dict[split[0]] = dict[split[0]] ? (dict[split[0]] + split[1]) : split[1];
  }
  return dict;
}

function summarizeScript(speech) {
  var nlu = new NaturalLanguageUnderstandingV1({
    username: "YOUR WATSON API USERNAME",
    password: "YOUR WATSON API PASSWORD",
    version_date: "2018-03-19"
  });

  return new Promise((res, rej) => {
    var keywords = '';
    return nlu.analyze(
      {
        html: speech,
        features: {
          concepts: {},
          keywords: {}
        }
      },
      function (err, response) {
        if (err) {
          console.log('error:', err);
        } else {
          res(response);
        }
      }
    );
  });
}

var promiseRes = null;
function promiseTester() {
  return new Promise((res, rej) => {
    promiseRes = res;
  });

}

var globalI = 0
// Get token using your credentials
app.post('/api/slack', (req, res, next) => {

  var utc = new Date().toJSON().slice(0, 10).replace(/-/g, '/');
  let headerMessage = 'Title: Standup Meeting.\nDate:' + utc + '\n ------------------\n';

  console.log(headerMessage);
  let data = req.body;


  let speakerConvoSplit = groupSpeakerConvo(data.test);
  var keys = Object.keys(speakerConvoSplit);

  var speakerKeywords = {};
  var i;
  for (i = 0; i < keys.length; i++) {
    summarizeScript(speakerConvoSplit[keys[i]]).then((keywords) => {
      globalI++;
      var currentSpeakerKeywords = [];
      for (var j = 0; j < keywords['keywords'].length; j++) {
        currentSpeakerKeywords.push(keywords.keywords[j].text);
      }
      speakerKeywords[keys[globalI - 1]] = currentSpeakerKeywords;
      if (globalI == (keys.length)) {
        promiseRes(speakerKeywords)
      }
    });
  }

  var keywordFinalizer = '------------------\nKeywords/Important Points:\n';
  promiseTester().then((speakerKeywords) => {
    var speakerNames = Object.keys(speakerKeywords);
    speakerNames.sort();
    for (var i = 0; i < Object.keys(speakerKeywords).length; i++) {
      keywordFinalizer = keywordFinalizer + speakerNames[i] + '  :  ' + speakerKeywords[speakerNames[i]] + '\n';
    }
    let script = '```' + headerMessage + data.test + keywordFinalizer + '```';
    callAPI(script);
    globalI = 0;
  });
});

module.exports = app;
