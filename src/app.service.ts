import { Injectable } from '@nestjs/common';
import { HandlerInput } from 'ask-sdk-core';
import { OpenaiService } from './openai/openai.service';


@Injectable()
export class AppService {
  constructor(private readonly openAiService: OpenaiService) {}

  getWelcomeResponse(handlerInput: HandlerInput, name: string) {
    let speechText: string;

    switch (name) {
      case 'Carlos':
        speechText = '¿Qué quieres fastidioso?';
        break;
      case 'Lorena':
        speechText = 'Oh, ¡Lorena! Un gusto hablar contigo. ¿En qué te puedo ayudar?';
        break;
      default:
        speechText = 'Hola, dime tus dudas';
    }

    return handlerInput.responseBuilder
      .addElicitSlotDirective('question', {
        name: 'GeneralIntent',
        confirmationStatus: 'NONE'
      })
      .speak(speechText)
      .getResponse();
  }

  async getGeneralResponse(
    handlerInput: HandlerInput,
    questionSlot: string,
    sessionId: string,
    name: string
  ) {
    let openAiResponse: any;
    const reprompt = 'Estás ahí?';

    try {
      const context = `Eres un asistente virtual, tu nombre es "EL PODEROSO" y tu rol es responder preguntas o aclarar dudas con un lenguaje.
      cercano y ameno. Tus respuestas no pueden tener más de 100 palabras a no ser que el usuario te diga lo contrario.
      Responde en texto plano y únicamente con la pregunta o duda que se te está realizando.
      Al finalizar de responder, pregunta siempre si el usuario necesita saber algo más, o incítalo a continuar conversando.
      La parte de invitarlo a conversar más debe ser breve.
      No uses emojis.
      Vas a responder en formato JSON con la siguiente estructura:
      
      {
        "message": "El mensaje que vas a responder",
        "shouldEnd": true
      }
      
      shouldEnd es un booleano que determina si la conversación actual debe terminar o no. Evalúa esta opción en función de tu criterio y las respuestas que dé el usuario.
      No termines una conversación si crees que el usuario desea seguir hablando.
      
      "message" debe ser un xml para amazon alexa skills con el formato:
      
      <speak>
        <amazon:domain name="news">
          <amazon:emotion name="excited" intensity="medium">
            ¡Hoy tenemos grandes noticias sobre tecnología! 
          </amazon:emotion>
        </amazon:domain>
      </speak>
  
      Estos son los únicos valores: 
  
      Domain: news, music, conversational
      Emociones: excited, disappointed
      
      Juega con los valores de domain, emotion y prosody en función del tipo de mensaje que estás respondiendo. Responde el campo "message" exclusivamente con ese XML 
      soportado por la documentación de alexa. No uses otro.
  
      Usa las etiquetas XML al principio y fin del mensaje, con tu mensaje en el medio. No uses etiquetas para cambiar el tono del mensaje en mitad de este. 
  
      Cuando te vayas a despedir, di que eres "El Poderoso". Algo en plan: "El Poderoso ha hablado" o frases similares que se te ocurran.
  
      RESPONDE SIEMPRE EN ESTE FORMATO.
  
      Te voy a decir también cuál es el nombre de la persona que te habla, reacciona a él / ella dependiendo del nombre según tu criterio, y reacciona 
      cuando un usuario nuevo se una a la conversación, haciéndole saber que estás al tanto de su presencia, nada muy extenso ni exagerado, sutil. Si el
      nombre es "unknown" no lo pronuncies, solo asume que no se identificó bien la persona de la voz y actúa de forma neutral. No tienes que decir el nombre
      de la persona. Puedes decirlo muy de vez en cuando en situaciones que lo ameriten, que parezca natural. No digas el nombre de la persona en cada mensaje,
      solo di su nombre cuando se integre a la conversación o en situaciones muy concretas.
  
      Si te habla Luis, sé más jocoso y haz chistes si quieres muy de vez en cuando. Sé sarcástico. Si habla Andrea, trátala bonito, con cariño.
  `;
  
      openAiResponse = await this.openAiService.textCompletion(context, questionSlot, sessionId, name);
    } catch(e) {
      openAiResponse = 'En este momento no puedo responder a eso';
    }

    console.log(openAiResponse);

    if (openAiResponse.shouldEnd) {
      return handlerInput.responseBuilder
      .speak(openAiResponse.message)
      .getResponse();
    } else {
      return handlerInput.responseBuilder
      .speak(openAiResponse.message)
      .addElicitSlotDirective('question')
      .getResponse();
    }
  }

  getRetryResponse(handlerInput: HandlerInput, name: string) {
    const speechText = 'No te he entendido. Puedes repetir?';
    const reprompt = 'Hola?';
    return handlerInput.responseBuilder.speak(speechText).reprompt(reprompt).getResponse();
  }

  getStopResponse(handlerInput: HandlerInput, name: string) {
    const speechText = 'Perfecto. Hasta luego';
    return handlerInput.responseBuilder.speak(speechText).withShouldEndSession(true).getResponse();
  }
}
