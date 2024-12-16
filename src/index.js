import dotenv from 'dotenv';
import express from 'express';
import { ExpressAdapter } from 'ask-sdk-express-adapter';
import { SkillBuilders } from 'ask-sdk-core';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const openaiApiKey = process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.trim() : '';
const openaiOrganization = process.env.OPENAI_ID_ORGANIZATION ? process.env.OPENAI_ID_ORGANIZATION.trim() : '';

if (!openaiApiKey || openaiApiKey.length < 20) {
    console.error('Error: La clave de la API de OpenAI no es válida o está vacía.');
    process.exit(1);
}

const openai = new OpenAI({
    organization: openaiOrganization,
    apiKey: openaiApiKey,
});

// Handlers de la Skill
const LaunchRequestHandler = {
    canHandle(handlerInput) {
        console.debug('LaunchRequestHandler - canHandle check:', handlerInput.requestEnvelope);
        return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
    },
    handle(handlerInput) {
        console.debug('LaunchRequestHandler - Handling LaunchRequest:', handlerInput.requestEnvelope);
        const speakOutput = '¡Hola! Estoy aquí para ayudarte. ¿En qué puedo asistirte hoy?';
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('¿En qué puedo ayudarte hoy?')
            .getResponse();
    }
};
const ChatIntentHandler = {
    canHandle(handlerInput) {
        console.debug('ChatIntentHandler - canHandle check:', handlerInput.requestEnvelope);
        return handlerInput.requestEnvelope.request.type === 'IntentRequest' && 
               handlerInput.requestEnvelope.request.intent.name === 'chat';
    },
    async handle(handlerInput) {
        console.debug('ChatIntentHandler - Handling ChatIntent:', handlerInput.requestEnvelope);
        const intent = handlerInput.requestEnvelope.request.intent.name;
        console.log(`Intent reconocido: ${intent}`);
        
        const userQuery = handlerInput.requestEnvelope.request.intent.slots?.query?.value || 'No se recibió una consulta.';
        console.debug(`Valor del slot \"query\": ${userQuery}`);

        try {
            console.log('Enviando petición a OpenAI...');
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: userQuery }],
                max_tokens: 100
            });
            console.debug('Respuesta completa de OpenAI:', JSON.stringify(response, null, 2));
            
            const chatGptResponse = response?.choices?.[0]?.message?.content || 'No se recibió una respuesta válida de OpenAI';
            console.debug(`Respuesta de ChatGPT: \"${chatGptResponse}\"`);

            return handlerInput.responseBuilder
                .speak(chatGptResponse)
                .reprompt('¿En qué más puedo ayudarte?')
                .withShouldEndSession(false) // No cerrar la sesión
                .getResponse();
        } catch (error) {
            console.error('❌ Error al conectar con la API de OpenAI:', error);
            return handlerInput.responseBuilder
                .speak('Hubo un error al obtener la respuesta de ChatGPT. Por favor, inténtalo de nuevo más tarde.')
                .withShouldEndSession(true) // Cerrar la sesión en caso de error
                .getResponse();
        }
    }
};


const FallbackIntentHandler = {
    canHandle(handlerInput) {
        console.debug('FallbackIntentHandler - canHandle check:', handlerInput.requestEnvelope);
        return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
               handlerInput.requestEnvelope.request.intent.name === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        console.debug('FallbackIntentHandler - Handling FallbackIntent:', handlerInput.requestEnvelope);
        console.log('FallbackIntent: No se entendió la petición del usuario.');
        return handlerInput.responseBuilder
            .speak('Lo siento, no entendí eso. ¿Podrías repetir tu pregunta de otra forma?')
            .reprompt('¿Podrías decirme en qué puedo ayudarte?')
            .getResponse();
    }
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        console.debug('SessionEndedRequestHandler - canHandle check:', handlerInput.requestEnvelope);
        return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.debug('SessionEndedRequestHandler - Handling SessionEndedRequest:', handlerInput.requestEnvelope);
        console.log('💤 SessionEndedRequest recibido, la sesión ha terminado.');
        return handlerInput.responseBuilder.getResponse();
    }
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.error('❌ Error en la skill:', error);
        console.debug('ErrorHandler - Handling error with requestEnvelope:', handlerInput.requestEnvelope);
        return handlerInput.responseBuilder
            .speak('Ocurrió un error inesperado. Por favor, intenta nuevamente.')
            .reprompt('¿En qué puedo ayudarte?')
            .getResponse();
    }
};

// Construcción de la skill con los handlers
const skill = SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        ChatIntentHandler,
        FallbackIntentHandler,
        SessionEndedRequestHandler
    )
    .addErrorHandlers(ErrorHandler)
    .create();

// Conexión de la skill con Express usando ExpressAdapter
const adapter = new ExpressAdapter(skill, true, true); // Habilita la verificación de la firma y del timestamp

// Ruta principal de la skill
app.post('/alexa', adapter.getRequestHandlers());

app.listen(port, () => {
    console.log(`🌐 Server is running on port ${port}`);
});
