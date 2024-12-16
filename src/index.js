import dotenv from 'dotenv';
import express from 'express';
import { ExpressAdapter } from 'ask-sdk-express-adapter';
import { SkillBuilders } from 'ask-sdk-core';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const openaiApiKey = process.env.OPENAI_API_KEY.trim();
const openai = new OpenAI({ apiKey: openaiApiKey });

const GeneralHandler = {
    canHandle(handlerInput) {
        return ['LaunchRequest', 'IntentRequest', 'SessionEndedRequest'].includes(handlerInput.requestEnvelope.request.type);
    },
    async handle(handlerInput) {
        const requestType = handlerInput.requestEnvelope.request.type;
        console.log(`📡 Solicitud recibida de tipo: ${requestType}`);
        
        if (requestType === 'LaunchRequest') {
            return handlerInput.responseBuilder
                .speak('¡Hola! Estoy aquí para ayudarte. ¿En qué puedo asistirte hoy?')
                .reprompt('Por favor, dime en qué puedo ayudarte.')
                .withShouldEndSession(false) // No termina la sesión
                .getResponse();
        }

        if (requestType === 'IntentRequest') {
            const intentName = handlerInput.requestEnvelope.request.intent.name;
            if (intentName === 'chat') {
                try {
                    const userQuery = handlerInput.requestEnvelope.request.intent.slots?.query?.value || 'No se recibió una consulta.';
                    const response = await openai.chat.completions.create({
                        model: 'gpt-4o-mini',
                        messages: [{ role: 'user', content: userQuery }],
                        max_tokens: 100
                    });
                    const chatGptResponse = response?.choices?.[0]?.message?.content || 'No se recibió respuesta de OpenAI';
                    
                    return handlerInput.responseBuilder
                        .speak(chatGptResponse)
                        .reprompt('¿En qué más puedo ayudarte?') // Reprompt mantiene la sesión abierta
                        .withShouldEndSession(false) // La sesión permanece abierta
                        .addDirective({
                            type: 'Dialog.ElicitSlot',
                            slotToElicit: 'query'
                        }) // Se asegura de que Alexa espere la entrada del usuario
                        .getResponse();
                } catch (error) {
                    console.error('❌ Error al obtener respuesta de OpenAI:', error);
                    return handlerInput.responseBuilder
                        .speak('Hubo un error con ChatGPT. Intenta nuevamente.')
                        .reprompt('¿En qué puedo ayudarte?')
                        .withShouldEndSession(false)
                        .getResponse();
                }
            }
        }

        return handlerInput.responseBuilder
            .speak('No entendí tu solicitud. Intenta nuevamente.')
            .reprompt('¿Podrías decirme en qué puedo ayudarte?')
            .withShouldEndSession(false)
            .getResponse();
    }
};

const ErrorHandler = {
    canHandle() {
        return true; 
    },
    handle(handlerInput, error) {
        console.error('❌ Error:', error);
        return handlerInput.responseBuilder
            .speak('Hubo un error inesperado. Inténtalo de nuevo.')
            .reprompt('¿En qué puedo ayudarte?')
            .withShouldEndSession(false) 
            .getResponse();
    }
};

const skill = SkillBuilders.custom()
    .addRequestHandlers(GeneralHandler)
    .addErrorHandlers(ErrorHandler)
    .create();

const adapter = new ExpressAdapter(skill, true, true);

app.post('/alexa', adapter.getRequestHandlers());

app.listen(port, () => {
    console.log(`🌐 Server is running on port ${port}`);
});
