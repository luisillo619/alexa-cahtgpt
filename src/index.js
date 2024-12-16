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
    console.error('❌ Error: La clave de la API de OpenAI no es válida o está vacía.');
    process.exit(1);
}

const openai = new OpenAI({
    organization: openaiOrganization,
    apiKey: openaiApiKey,
});

// ===============================
// 🔥 Handlers de la Skill
// ===============================

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
    },
    async handle(handlerInput) {
        console.log('🔄 Lanzando la skill (LaunchRequest)');
        
        const userQuery = 'Preséntate como asistente virtual y explica en qué puedes ayudar.';
        try {
            console.log('📡 Enviando petición a OpenAI para LaunchRequest...');
            
            const prompt = `Responde siempre en texto plano sin usar etiquetas de audio ni indicaciones de solo audio. Responde de forma clara. La consulta es: "${userQuery}"`;
            
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 150
            });

            let chatGptResponse = response?.choices?.[0]?.message?.content || 'No se recibió una respuesta válida de OpenAI';
            chatGptResponse = cleanResponse(chatGptResponse);
            
            console.log(`💬 Respuesta de ChatGPT (LaunchRequest): "${chatGptResponse}"`);

            return handlerInput.responseBuilder
                .speak(chatGptResponse)
                .reprompt('¿En qué más puedo ayudarte?')
                .getResponse();
        } catch (error) {
            console.error('❌ Error al conectar con la API de OpenAI (LaunchRequest):', error);
            return handlerInput.responseBuilder
                .speak('Ocurrió un error al iniciar la conversación. Por favor, inténtalo de nuevo más tarde.')
                .reprompt('¿En qué más puedo ayudarte?')
                .getResponse();
        }
    }
};

const ChatIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest';
    },
    async handle(handlerInput) {
        const userQuery = handlerInput.requestEnvelope.request.intent.slots?.query?.value || 'No se recibió una consulta.';
        console.log(`📨 Valor del slot "query": ${userQuery}`);

        try {
            console.log('📡 Enviando petición a OpenAI...');

            const prompt = `Responde siempre en texto plano sin usar etiquetas de audio ni indicaciones de solo audio. Responde de forma clara. La consulta es: "${userQuery}"`;
            
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 150
            });

            let chatGptResponse = response?.choices?.[0]?.message?.content || 'No se recibió una respuesta válida de OpenAI';
            chatGptResponse = cleanResponse(chatGptResponse);
            
            console.log(`💬 Respuesta de ChatGPT: "${chatGptResponse}"`);

            return handlerInput.responseBuilder
                .speak(chatGptResponse)
                .reprompt('¿En qué más puedo ayudarte?')
                .getResponse();
        } catch (error) {
            console.error('❌ Error al conectar con la API de OpenAI:', error);
            return handlerInput.responseBuilder
                .speak('Hubo un error al obtener la respuesta de ChatGPT. Por favor, inténtalo de nuevo más tarde.')
                .reprompt('¿Puedo ayudarte con algo más?')
                .getResponse();
        }
    }
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`💤 SessionEndedRequest recibido, la sesión ha terminado.`);
        return handlerInput.responseBuilder.getResponse();
    }
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.error('❌ Error en la skill:', error.message);
        return handlerInput.responseBuilder
            .speak('Ocurrió un error inesperado. Por favor, intenta nuevamente.')
            .reprompt('¿En qué puedo ayudarte?')
            .getResponse();
    }
};

// ===============================
// 🔥 Función de limpieza de respuestas
// ===============================

function cleanResponse(response) {
    if (response.includes('<Audio only response>')) {
        console.warn('⚠️ Se detectó una respuesta de "solo audio". Se reemplaza por texto.');
        response = 'Lo siento, no puedo ofrecer una respuesta de solo audio en este momento. ¿Te gustaría preguntar algo más?';
    }

    response = response.replace(/<audio[^>]*>(.*?)<\/audio>/g, ''); // Remover <audio>...</audio>
    response = response.replace(/<[^>]*>/g, ''); // Remover cualquier etiqueta HTML
    response = response.trim(); // Quitar espacios extra
    return response;
}

// ===============================
// 🔥 Configuración de la Skill y servidor Express
// ===============================

const skill = SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        ChatIntentHandler,
        SessionEndedRequestHandler
    )
    .addErrorHandlers(ErrorHandler)
    .create();

const adapter = new ExpressAdapter(skill, true, true);

app.post('/alexa', adapter.getRequestHandlers());

app.listen(port, () => {
    console.log(`🌐 Server is running on port ${port}`);
});
