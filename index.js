'use strict';
const alexa = require('alexa-app');
const _ = require('underscore');
const express = require('express');
const bodyParser = require('body-parser');
const PubSub = require('pubsub-js');
const Joi = require('joi');
const MessageModel = require('./MessageModel.js')(Joi);
const messageModelUtil = require('./messageModelUtil.js');
const webhook = require('./webhook.js');
const Promise = require('promise');

PubSub.immediateExceptions = true;

var PORT = process.env.port || 8080;
var express_app = express();
var alexa_app = new alexa.app("app");

var metadata = {
    allowConfigUpdate: true,
    waitForMoreResponsesMs: 200,
    appId: 'amzn1.ask.skill.1c0c1066-2e32-4a15-8749-4f57331fee58',
    channelSecretKey: 'lUOGRnEyLui643VNCigFDMcTso8r2G5Y',
    channelUrl: 'https://amce2bmxp-univcreditsavt.mobile.ocp.oraclecloud.com:443/connectors/v1/tenants/idcs-188833f670f149a3ac2892ac9359b66e/listeners/webhook/channels/639F5DE9-940A-4DC9-8459-32E628C2014D'
};
var randomIntInc = function (low, high) {
    return Math.floor(Math.random() * (high - low + 1) + low);
};

var setConfig = function(config) {
    metadata = _.extend(metadata, _.pick(config, _.keys(metadata)));
}

var sendWebhookMessageToBot= function (channelUrl, channelSecretKey, userId, messagePayload, additionalProperties, callback) {
    webhook.messageToBot(channelUrl, channelSecretKey, userId, messagePayload, additionalProperties, callback);
};

function menuResponseMap (resp, card) {
    var responseMap = {};

    function addToMap (label, type, action) {
      responseMap[label] = {type: type, action: action};
    }

    if (!card) {
      if (resp.globalActions && resp.globalActions.length > 0) {
        resp.globalActions.forEach(function (gAction) {
          addToMap(gAction.label, 'global', gAction);
        });
      }
      if (resp.actions && resp.actions.length > 0) {
        resp.actions.forEach(function (action) {
          addToMap(action.label, 'message', action);
        });
      }
      if (resp.type === 'card' && resp.cards && resp.cards.length > 0) {
        resp.cards.forEach(function (card) {
          //special menu option to navigate to card detail
          addToMap('Card ' + card.title, 'card', {type: 'custom', value: {type: 'card', value: card}});
        });
      }
    } else {
      if (card.actions && card.actions.length > 0) {
        card.actions.forEach(function (action) {
          addToMap(action.label, 'message', action);
        });
      }
      //special menu option to return to main message from the card
      addToMap('Return', 'cardReturn', {type: 'custom', value: {type: 'messagePayload', value: resp}});
    }
    return responseMap;
}

if (metadata.allowConfigUpdate) {
    express_app.put('/config', bodyParser.json(), function(req, res){
      let config = req.body;
      if (config) {
        setConfig(config);
      }
      res.sendStatus(200).send();
    });
}


///////////////////////////////////////////////////////////////////////////////////////////////////////
alexa_app.intent("CommandBot", {}, function(alexa_req, alexa_res) {
    var session = alexa_req.getSession();
    //var userId = session.get("userId");
    var input = alexa_req.slot("command");
    console.log(input);
    var userId = "ignacio.dones@avanttic.com";
    if (!userId) {
        userId = session.details.user.userId;
        if (!userId) {
          userId = randomIntInc(1000000, 9999999).toString();
        }
        session.set("userId", userId);
    }
    alexa_res.shouldEndSession(false);
    if (metadata.channelUrl && metadata.channelSecretKey && userId) {
        const userIdTopic = userId;
        var respondedToAlexa = false;
        var additionalProperties = {
          "profile": {
            "clientType": "alexa"
          }
        };
        var sendToAlexa = function (resolve, reject) {
          if (!respondedToAlexa) {
            respondedToAlexa = true;
            console.log('Prepare to send to Alexa');
            //alexa_res.send();
            resolve();
            PubSub.unsubscribe(userIdTopic);
          } else {
            console.log("Already sent response");
          }
        };
        // compose text response to alexa, and also save botMessages and botMenuResponseMap to alexa session so they can be used to control menu responses next
        var navigableResponseToAlexa = function (resp) {
          var respModel;
          if (resp.messagePayload) {
            respModel = new MessageModel(resp.messagePayload);
          } else {
            // handle 1.0 webhook format as well
            respModel = new MessageModel(resp);
          }
          var botMessages = session.get("botMessages");
          if (!Array.isArray(botMessages)) {
            botMessages = [];
          }
          var botMenuResponseMap = session.get("botMenuResponseMap");
          if (typeof botMenuResponseMap !== 'object') {
            botMenuResponseMap = {};
          }
          botMessages.push(respModel.messagePayload());
          session.set("botMessages", botMessages);
          session.set("botMenuResponseMap", Object.assign(botMenuResponseMap || {}, menuResponseMap(respModel.messagePayload())));
          let messageToAlexa = messageModelUtil.convertRespToText(respModel.messagePayload());
          console.log("Message to Alexa (navigable):", messageToAlexa)
          alexa_res.say(messageToAlexa);
        };

        var sendMessageToBot = function (messagePayload) {
          console.log('Creating new promise for', messagePayload);
          return new Promise(function(resolve, reject){
            var commandResponse = function (msg, data) {
              console.log('Received callback message from webhook channel');
              var resp = data;
              console.log('Parsed Message Body:', resp);
              if (!respondedToAlexa) {
                navigableResponseToAlexa(resp);
              } else {
                console.log("Already processed response");
                return;
              }
              if (metadata.waitForMoreResponsesMs) {
                _.delay(function () {
                  sendToAlexa(resolve, reject);
                }, metadata.waitForMoreResponsesMs);
              } else {
                sendToAlexa(resolve, reject);
              }
            };
            var token = PubSub.subscribe(userIdTopic, commandResponse);
            sendWebhookMessageToBot(metadata.channelUrl, metadata.channelSecretKey, userId, messagePayload, additionalProperties, function (err) {
              if (err) {
                console.log("Failed sending message to Bot");
                alexa_res.say("Failed sending message to Bot.  Please review your bot configuration.");
                reject();
                PubSub.unsubscribe(userIdTopic);
              }
            });
          });
        };
        var handleInput = function (input) {
          var botMenuResponseMap = session.get("botMenuResponseMap");
          if (typeof botMenuResponseMap !== 'object') {
            botMenuResponseMap = {};
          }
          //var menuResponse = botUtil.approxTextMatch(input, _.keys(botMenuResponseMap), true, true, 7);
          var botMessages = session.get("botMessages");
          //if command is a menu action
          //if (menuResponse) {
          if (false) {
            var menu = botMenuResponseMap[menuResponse.item];
            // if it is global action or message level action
            if (['global', 'message'].includes(menu.type)) {
              var action = menu.action;
              session.set("botMessages", []);
              session.set("botMenuResponseMap", {});
              if (action.type === 'postback') {
                var postbackMsg = MessageModel.postbackConversationMessage(action.postback);
                return sendMessageToBot(postbackMsg);
              } else if (action.type === 'location') {
                console.log('Sending a predefined location to bot');
                return sendMessageToBot(MessageModel.locationConversationMessage(37.2900055, -121.906558));
              }
              // if it is navigating to card detail
            } else if (menu.type === 'card') {
              var selectedCard;
              if (menu.action && menu.action.type && menu.action.type === 'custom' && menu.action.value && menu.action.value.type === 'card') {
                selectedCard = _.clone(menu.action.value.value);
              }
              if (selectedCard) {
                if (!Array.isArray(botMessages)) {
                  botMessages = [];
                }
                var selectedMessage;
                if (botMessages.length === 1) {
                  selectedMessage = botMessages[0];
                } else {
                  selectedMessage = _.find(botMessages, function (botMessage) {
                    if (botMessage.type === 'card') {
                      return _.some(botMessage.cards, function (card) {
                        return (card.title === selectedCard.title);
                      });
                    } else {
                      return false;
                    }
                  });
                }
                if (selectedMessage) {
                  //session.set("botMessages", [selectedMessage]);
                    session.set("botMenuResponseMap", menuResponseMap(selectedMessage, selectedCard));
                    let messageToAlexa = messageModelUtil.cardToText(selectedCard, 'Card');
                    console.log("Message to Alexa (card):", messageToAlexa)
                    alexa_res.say(messageToAlexa);
                    return alexa_res.send();
                }
              }
              // if it is navigating back from card detail
            } else if (menu.type === 'cardReturn') {
              var returnMessage;
              if (menu.action && menu.action.type && menu.action.type === 'custom' && menu.action.value && menu.action.value.type === 'messagePayload') {
                returnMessage = _.clone(menu.action.value.value);
              }
              if (returnMessage) {
                //session.set("botMessages", [returnMessage]);
                  session.set("botMenuResponseMap", _.reduce(botMessages, function(memo, msg){
                    return Object.assign(memo,menuResponseMap(msg));
                  }, {}));
                  //session.set("botMenuResponseMap", menuResponseMap(returnMessage));
                  _.each(botMessages, function(msg){
                    let messageToAlexa = messageModelUtil.convertRespToText(msg);
                    console.log("Message to Alexa (return from card):", messageToAlexa);
                    alexa_res.say(messageToAlexa);
                  })
                  return alexa_res.send();
              }
            }
          } else {
            var commandMsg = MessageModel.textConversationMessage(input);
            return sendMessageToBot(commandMsg);
          }
        };
        return handleInput(input);
    } else {
          console.log('fuera del if');
        _.defer(function () {
          alexa_res.say("I don't understand. Could you please repeat what you want?");
          //alexa_res.send();
        });
    }
      //return false;
    // return talkToChat(input, userId).then(function (value){
    //     response.say("talking to chat").shouldEndSession(false);
    // }).catch(function(error){
    //     console.log(error);
    // });
});

alexa_app.launch(function(alexa_req, alexa_res) {
    var session = alexa_req.getSession();
    session.set("startTime", Date.now());
    alexa_res.say("Welcome to Tech Buyer, start creating a list!")
        .shouldEndSession(false);
});

// alexa_app.pre = function (alexa_req, alexa_res, type) {
//     if (alexa_req.data.session.application.applicationId != metadata.appId) {
//         alexa_res.fail("Invalid applicationId");
//     }
//     if (!metadata.channelUrl || !metadata.channelSecretKey) {
//       var message = "The singleBot cannot respond. Please check the channel and secret key configuration.";
//       alexa_res.fail(message);
//     }
// };

express_app.post('/webhook', bodyParser.json(), (req, res)=>{
    if (webhook.verifyMessageFromBot(req.get('X-Hub-Signature'), req.body, metadata.channelSecretKey)) {
        var message = req.body;
        const userId = req.body.userId;
        if (!userId) {
            return res.status(400).send('Missing User ID');
        }
        res.sendStatus(200);
        PubSub.publish(userId, message);
    } else {
        console.log("Todo mal");
        res.sendStatus(403);
    }
});

alexa_app.express({ expressApp: express_app, checkCert: false });
express_app.listen(PORT, ()=>{
    console.log('Corriendo en puerto: '+PORT);
});