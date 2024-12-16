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

/**
 * Manejador General de la Skill.
 * Este manejador gestiona LaunchRequest, IntentRequest y SessionEndedRequest.
 */
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
                .withShouldEndSession(undefined) // Mantiene la sesión abierta
                .getResponse();
        }

        if (requestType === 'IntentRequest') {
            const intentName = handlerInput.requestEnvelope.request.intent.name;
            const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

            if (intentName === 'chat') {
                try {
                    const userQuery = handlerInput.requestEnvelope.request.intent.slots?.query?.value || 'No se recibió una consulta.';
                    console.log('🗣️ Usuario dijo:', userQuery);

                    const response = await openai.chat.completions.create({
                        model: 'gpt-4o-mini',
                        messages: [{ role: 'user', content: userQuery }],
                        max_tokens: 100
                    });

                    const chatGptResponse = response?.choices?.[0]?.message?.content || 'No se recibió respuesta de OpenAI';
                    console.log('🤖 Respuesta de OpenAI:', chatGptResponse);

                    // Guardar en sessionAttributes para el seguimiento de la conversación
                    sessionAttributes['lastUserQuery'] = userQuery;
                    sessionAttributes['lastChatResponse'] = chatGptResponse;
                    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

                    return handlerInput.responseBuilder
                        .speak(chatGptResponse)
                        .reprompt('¿En qué más puedo ayudarte?')
                        .withShouldEndSession(undefined) // Mantiene la sesión abierta
                        .getResponse();
                } catch (error) {
                    console.error('❌ Error en OpenAI:', error);
                    return handlerInput.responseBuilder
                        .speak('Hubo un error al conectar con ChatGPT. Inténtalo nuevamente.')
                        .reprompt('¿En qué puedo ayudarte?')
                        .withShouldEndSession(undefined) // Mantiene la sesión abierta
                        .getResponse();
                }
            }

            // Si no se reconoce el intent
            return handlerInput.responseBuilder
                .speak('No entendí tu solicitud. Intenta nuevamente.')
                .reprompt('¿Podrías decirme en qué puedo ayudarte?')
                .withShouldEndSession(undefined) // Mantiene la sesión abierta
                .getResponse();
        }

        // Manejo del SessionEndedRequest
        if (requestType === 'SessionEndedRequest') {
            const reason = handlerInput.requestEnvelope.request.reason || 'No se proporcionó una razón';
            console.log('💤 La sesión terminó. Razón:', reason);

            if (reason === 'EXCEEDED_MAX_REPROMPTS') {
                console.log('🔄 Reiniciando la sesión por falta de respuesta del usuario');
                return handlerInput.responseBuilder
                    .speak('Parece que no me respondiste. ¿En qué puedo ayudarte ahora?')
                    .reprompt('¿En qué puedo ayudarte?')
                    .withShouldEndSession(undefined) 
                    .getResponse();
            }

            return handlerInput.responseBuilder.getResponse();
        }

        // Respuesta predeterminada si no se reconoce la solicitud
        return handlerInput.responseBuilder
            .speak('No se pudo manejar tu solicitud. Intenta nuevamente.')
            .withShouldEndSession(true) // Cierra la sesión
            .getResponse();
    }
};

/**
 * Controlador de Errores
 * Captura todos los errores no manejados en la ejecución de la skill.
 */
const ErrorHandler = {
    canHandle() {
        return true; 
    },
    handle(handlerInput, error) {
        console.error('❌ Error:', error);
        return handlerInput.responseBuilder
            .speak('Hubo un error inesperado. Inténtalo de nuevo.')
            .reprompt('¿En qué puedo ayudarte?')
            .withShouldEndSession(false) // Mantiene la sesión abierta
            .getResponse();
    }
};

/**
 * Manejador de la solicitud de cierre de sesión (SessionEndedRequest)
 */
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log('💤 La sesión terminó.');
        return handlerInput.responseBuilder.getResponse();
    }
};

/**
 * Creación del Skill
 */
const skill = SkillBuilders.custom()
    .addRequestHandlers(
        GeneralHandler,
        SessionEndedRequestHandler
    )
    .addErrorHandlers(ErrorHandler)
    .create();

/**
 * Adaptador Express para alojar la skill en un servidor web
 */
const adapter = new ExpressAdapter(skill, true, true);

// Ruta para la skill de Alexa
app.post('/alexa', adapter.getRequestHandlers());

// Inicio del servidor web
app.listen(port, () => {
    console.log(`🌐 El servidor está corriendo en el puerto ${port}`);
});
