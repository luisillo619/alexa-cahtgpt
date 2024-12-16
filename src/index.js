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
        const requestType = handlerInput.requestEnvelope.request.type;
        return ['LaunchRequest', 'IntentRequest', 'SessionEndedRequest'].includes(requestType);
    },
    async handle(handlerInput) {
        const requestType = handlerInput.requestEnvelope.request.type;
        console.log(`📡 Solicitud recibida de tipo: ${requestType}`);
        
        if (requestType === 'LaunchRequest') {
            const speakOutput = '¡Hola! Estoy aquí para ayudarte. ¿En qué puedo asistirte hoy?';
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt('Por favor, dime en qué puedo ayudarte.')
                .withShouldEndSession(false) 
                .getResponse();
        }

        if (requestType === 'IntentRequest') {
            const intentName = handlerInput.requestEnvelope.request.intent.name;
            console.log(`🎯 Intent detectado: ${intentName}`);
            
            if (intentName === 'chat') {
                const userQuery = handlerInput.requestEnvelope.request.intent.slots?.query?.value || 'No se recibió una consulta.';
                console.debug(`📩 Slot recibido (query): ${userQuery}`);

                try {
                    console.log('Enviando petición a OpenAI...');
                    const response = await openai.chat.completions.create({
                        model: 'gpt-4o-mini',
                        messages: [{ role: 'user', content: userQuery }],
                        max_tokens: 100
                    });

                    const chatGptResponse = response?.choices?.[0]?.message?.content || 'No se recibió una respuesta válida de OpenAI';
                    console.debug(`💬 Respuesta de ChatGPT: "${chatGptResponse}"`);

                    return handlerInput.responseBuilder
                        .speak(chatGptResponse)
                        .reprompt('¿En qué más puedo ayudarte?')
                        .withShouldEndSession(false) 
                        .getResponse();
                } catch (error) {
                    console.error('❌ Error al conectar con la API de OpenAI:', error);
                    return handlerInput.responseBuilder
                        .speak('Hubo un error al obtener la respuesta de ChatGPT. Por favor, inténtalo de nuevo más tarde.')
                        .withShouldEndSession(false) 
                        .getResponse();
                }
            }

            if (intentName === 'AMAZON.FallbackIntent') {
                return handlerInput.responseBuilder
                    .speak('Lo siento, no entendí eso. ¿Podrías repetir tu pregunta de otra forma?')
                    .reprompt('¿Podrías decirme en qué puedo ayudarte?')
                    .withShouldEndSession(false) 
                    .getResponse();
            }
        }

        if (requestType === 'SessionEndedRequest') {
            const reason = handlerInput.requestEnvelope.request.reason || 'No reason provided';
            console.log(`💤 Sesión finalizada. Razón: ${reason}`);

            return handlerInput.responseBuilder.getResponse(); // No cerramos explícitamente la sesión
        }

        return handlerInput.responseBuilder
            .speak('No entendí tu solicitud. Por favor, intenta nuevamente.')
            .reprompt('¿En qué puedo ayudarte?')
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
