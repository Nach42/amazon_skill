'use strict';
const Alexa = require('ask-sdk-core');
const _ = require('underscore');

//=========================================================================================================================================
//TODO: The items below this comment need your attention.
//=========================================================================================================================================

//Replace with your app ID (OPTIONAL).  You can find this value at the top of your skill's page on http://developer.amazon.com.
//Make sure to enclose your value in quotes, like this: const APP_ID = 'amzn1.ask.skill.bb4045e6-b3e8-4133-b650-72923c5980f1';
const APP_ID = 'amzn1.ask.skill.1c0c1066-2e32-4a15-8749-4f57331fee58';
var metadata = {
    waitForMoreResponsesMs: 500,
    appId: 'amzn1.ask.skill.1c0c1066-2e32-4a15-8749-4f57331fee58',
    channelSecretKey: '2ngdurGTGYRMW6dc5zfPwQlMmNtFhiE4',
    channelUrl: 'https://amce2bmxp-univcreditsavt.mobile.ocp.oraclecloud.com:443/connectors/v1/tenants/idcs-188833f670f149a3ac2892ac9359b66e/listeners/webhook/channels/FF688C19-69D0-47A2-979B-B92D9C0C8878'
};

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
    },
    handle(handlerInput) {
        const speechText = 'Saludos Gorgorita';
        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt()
            .withSimpleCard('Hello World', speechText)
            .getResponse();
    }
};
const HelloWorldIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'HelloWorldIntent';
    },
    handle(handlerInput) {
        const speechText = ['Este intent te saluda', 'qu pasa brodel'];
        return handlerInput.responseBuilder
            .speak(speechText[0])
            .speak(speechText[1])
            .reprompt()
            .withSimpleCard('Hello World', speechText)
            .getResponse();
    }
};
const OtroIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'OtroIntent';
    },
    handle(handlerInput) {
        const speechText = 'Esto es otro intent';
        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(speechText)
            .withSimpleCard('Hello World', speechText)
            .getResponse();
    }
};
const HelpIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speechText = 'Di hola';
        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(speechText)
            .withSimpleCard('Hello World', speechText)
            .getResponse();
    }
};
const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent'
                || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speechText = 'Goodbye!';
        return handlerInput.responseBuilder
            .speak(speechText)
            .withSimpleCard('Hello World', speechText)
            .getResponse();
    }
};
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        //any cleanup logic goes here
        return handlerInput.responseBuilder.getResponse();
    }
};
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`Error handled: ${error.message}`);
        return handlerInput.responseBuilder
            .speak('Sorry, I can\'t understand the command. Please say again.')
            .reprompt('Sorry, I can\'t understand the command. Please say again.')
            .getResponse();
    },
};
module.exports = function(){
    var self = this;
    this.init = function(config){
        var app = Alexa.SkillBuilders.custom()
        .addRequestHandlers(LaunchRequestHandler,
                            HelloWorldIntentHandler,
                            OtroIntentHandler,
                            HelpIntentHandler,
                            CancelAndStopIntentHandler,
                            SessionEndedRequestHandler)
        .addErrorHandlers(ErrorHandler)
        .lambda();
        return app;
    }
    return this
}
