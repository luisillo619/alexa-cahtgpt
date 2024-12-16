import { Controller, Get, Post, Res, Patch, Param, Delete, Req, HttpCode } from '@nestjs/common';
import { ErrorHandler, HandlerInput, RequestHandler, SkillBuilders } from 'ask-sdk-core';
import * as Alexa from 'ask-sdk-core';
import { Response } from 'ask-sdk-model';
import { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { AppService } from './app.service';

@Controller("alexa")
export class AppController {
  constructor(private readonly appService: AppService) {}

  PERMISSIONS = ['alexa::profile:given_name:read'];

  @Post()
  @HttpCode(200)
  async alexaSkill(@Req() req: ExpressRequest) {
    let skill = SkillBuilders.custom()
      .withApiClient(new Alexa.DefaultApiClient())
      .addRequestHandlers({
        canHandle: (handlerInput: HandlerInput) => {
          return true;
        },

        handle: (handlerInput: HandlerInput) => this.getResponse(handlerInput)
      } as RequestHandler)
      .addErrorHandlers({
        canHandle: (handlerInput: HandlerInput, error: Error) => {
          return true;
        },

        handle: (handlerInput: HandlerInput, error: Error) => {
          console.log(`Error handled: ${error.message}`);
          const errorText = 'No puedo entenderte. Repite por favor';
          return handlerInput.responseBuilder.speak(errorText).reprompt(errorText).getResponse();
        }
      } as RequestHandler)
      .create();

    return skill
      .invoke(req.body)
      .then(res => {
        return res;
      })
      .catch(err => {
        console.log(err);
      });
  }

  async getResponse(handlerInput: HandlerInput) {
    const requestType = Alexa.getRequestType(handlerInput.requestEnvelope);
    let intentName: string;
    let questionSlot: string;

    if (requestType === 'IntentRequest') {
      intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
      
      questionSlot = Alexa.getSlotValue(handlerInput.requestEnvelope, 'question');
    }

    const token =
      handlerInput.requestEnvelope.context.System.user.permissions &&
      handlerInput.requestEnvelope.context.System.user.permissions.consentToken;

    if (!token) {
      return handlerInput.responseBuilder
        .speak('Acepta los permisos primero')
        .withAskForPermissionsConsentCard(this.PERMISSIONS)
        .getResponse();
    }

    const client = handlerInput.serviceClientFactory.getUpsServiceClient();
    let userName;
    let voiceId;
    
    try {
      userName = await client.getPersonsProfileGivenName();
      userName = await client.getPersonsProfileGivenName();
    } catch(e) {
      userName = 'Unknown';
    }

    console.log('USER: ' + userName);
    console.log('REQUEST: ' + requestType);
    console.log('INTENT: ' + intentName);
    console.log('INPUT: ' + questionSlot);
    console.log('--------------------------');

    switch (requestType) {
      case 'LaunchRequest':
        return this.appService.getWelcomeResponse(handlerInput, userName);
      case 'IntentRequest':
        switch (intentName) {
          case 'GeneralIntent':
            const sessionId = handlerInput.requestEnvelope.session.sessionId;
            return this.appService.getGeneralResponse(handlerInput, questionSlot, sessionId, userName);
          case 'AMAZON.CancelIntent':
          case 'AMAZON.StopIntent':
            return this.appService.getStopResponse(handlerInput, userName);
          default:
            return this.appService.getRetryResponse(handlerInput, userName);
        }
      case 'SessionEndedRequest':
        return this.appService.getStopResponse(handlerInput, userName);
      default:
        return this.appService.getRetryResponse(handlerInput, userName);
    }
  }
}
