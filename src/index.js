import dotenv from 'dotenv';
import express from 'express';
import { ExpressAdapter } from 'ask-sdk-express-adapter';
import { SkillBuilders } from 'ask-sdk-core';
import { DynamoDbPersistenceAdapter } from 'ask-sdk-dynamodb-persistence-adapter';
import OpenAI from 'openai';

// 🔥 Cargar variables de entorno
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// 🔥 Configuración de la API de OpenAI
const openaiApiKey = process.env.OPENAI_API_KEY.trim();
const openai = new OpenAI({ apiKey: openaiApiKey });

// 🔥 Configuración de DynamoDB para la persistencia de atributos
const dynamoDbPersistenceAdapter = new DynamoDbPersistenceAdapter({
    tableName: 'AlexaUserSessionTable', // Nombre de la tabla DynamoDB
    createTable: true // Crea la tabla automáticamente si no existe
});

/**
 * 🔥 Manejador General de la Skill
 * Gestiona LaunchRequest, IntentRequest y delega la recopilación de slots.
 */
const GeneralHandler = {
    canHandle(handlerInput) {
        return ['LaunchRequest', 'IntentRequest'].includes(handlerInput.requestEnvelope.request.type);
    },
    async handle(handlerInput) {
        const requestType = handlerInput.requestEnvelope.request.type;
        console.log(`📡 Solicitud recibida de tipo: ${requestType}`);

        if (requestType === 'LaunchRequest') {
            console.log('🎉 Lanzando la skill');
            return handlerInput.responseBuilder
                .speak('¡Hola! Estoy aquí para ayudarte. ¿En qué puedo asistirte hoy?')
                .reprompt('Por favor, dime en qué puedo ayudarte.')
                .withShouldEndSession(false) // 🔥 Evita que la sesión se cierre
                .getResponse();
        }

        if (requestType === 'IntentRequest') {
            const intentName = handlerInput.requestEnvelope.request.intent.name;
            const slots = handlerInput.requestEnvelope.request.intent.slots;

            console.log(`📡 Intent detectado: ${intentName}`);
            console.log('📋 Slots:', slots);

            if (intentName === 'chat') {
                try {
                    const userQuery = slots.query?.value || 'No se recibió una consulta.';
                    console.log('🗣️ Usuario dijo:', userQuery);

                    // 🔥 Consultar a OpenAI
                    const response = await openai.chat.completions.create({
                        model: 'gpt-4o-mini',
                        messages: [{ role: 'user', content: userQuery }],
                        max_tokens: 100
                    });

                    const chatGptResponse = response?.choices?.[0]?.message?.content || 'No se recibió respuesta de OpenAI';
                    console.log('🤖 Respuesta de OpenAI:', chatGptResponse);

                    // 🔥 Persistir los atributos para la próxima sesión
                    const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
                    persistentAttributes.lastUserQuery = userQuery;
                    persistentAttributes.lastChatResponse = chatGptResponse;
                    await handlerInput.attributesManager.setPersistentAttributes(persistentAttributes);
                    await handlerInput.attributesManager.savePersistentAttributes();

                    return handlerInput.responseBuilder
                        .speak(chatGptResponse)
                        .reprompt('¿En qué más puedo ayudarte?')
                        .withShouldEndSession(false) // 🔥 Evita que la sesión se cierre
                        .getResponse();
                } catch (error) {
                    console.error('❌ Error en OpenAI:', error);
                    return handlerInput.responseBuilder
                        .speak('Hubo un error al conectar con ChatGPT. Inténtalo nuevamente.')
                        .reprompt('¿En qué puedo ayudarte?')
                        .withShouldEndSession(false) // 🔥 Evita que la sesión se cierre
                        .getResponse();
                }
            }

            // Intent no reconocido
            return handlerInput.responseBuilder
                .speak('No entendí tu solicitud. Intenta nuevamente.')
                .reprompt('¿Podrías decirme en qué puedo ayudarte?')
                .withShouldEndSession(false) // 🔥 Evita que la sesión se cierre
                .getResponse();
        }
    }
};

/**
 * 🔥 Controlador de errores
 * Captura todos los errores no manejados.
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
            .withShouldEndSession(false) // 🔥 Evita que la sesión se cierre
            .getResponse();
    }
};

/**
 * 🔥 Manejador para SessionEndedRequest
 * Se invoca cuando Alexa decide cerrar la sesión.
 */
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        const reason = handlerInput.requestEnvelope.request.reason || 'No se proporcionó una razón';
        console.log('💤 La sesión terminó. Razón:', reason);
        return handlerInput.responseBuilder.getResponse();
    }
};

/**
 * Creación de la Skill
 */
const skill = SkillBuilders.custom()
    .addRequestHandlers(
        GeneralHandler,
        SessionEndedRequestHandler
    )
    .addErrorHandlers(ErrorHandler)
    .withPersistenceAdapter(dynamoDbPersistenceAdapter) // 🔥 Conectar la persistencia con DynamoDB
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
