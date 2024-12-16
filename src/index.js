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
// 🔥 Unificar todos los manejadores en uno solo
// ===============================

const ChatHandler = {
    canHandle(handlerInput) {
        return true; // Este handler se ejecuta para cualquier tipo de solicitud
    },
    async handle(handlerInput) {
        try {
            const requestType = handlerInput.requestEnvelope.request.type;
            const intentName = handlerInput.requestEnvelope.request?.intent?.name;
            const slots = handlerInput.requestEnvelope.request?.intent?.slots || {};

            console.log(`🔍 Tipo de solicitud: ${requestType}`);
            console.log(`🎯 Intent recibido: ${intentName || 'No especificado'}`);

            let userQuery = 'Preséntate como asistente virtual y explica en qué puedes ayudar.'; // Consulta por defecto

            if (requestType === 'IntentRequest' && intentName) {
                // Intenta obtener la consulta del slot "query" si existe
                userQuery = slots?.query?.value || 'No se recibió una consulta específica del usuario.';
                console.log(`📨 Valor del slot "query": ${userQuery}`);
            }

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
            console.error('❌ Error en la skill:', error.message);
            return handlerInput.responseBuilder
                .speak('Ocurrió un error inesperado. Por favor, intenta nuevamente.')
                .reprompt('¿En qué puedo ayudarte?')
                .getResponse();
        }
    }
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.error('❌ Error global capturado:', error.message);
        return handlerInput.responseBuilder
            .speak('Ocurrió un error inesperado. Por favor, intenta nuevamente.')
            .reprompt('¿En qué más puedo ayudarte?')
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
    response = response.replace(/<speak[^>]*>(.*?)<\/speak>/g, ''); // Remover <speak>...</speak>
    response = response.replace(/<[^>]*>/g, ''); // Remover cualquier etiqueta HTML
    response = response.trim(); // Quitar espacios extra
    return response;
}

// ===============================
// 🔥 Configuración de la Skill y servidor Express
// ===============================

const skill = SkillBuilders.custom()
    .addRequestHandlers(ChatHandler) // Solo un manejador para todo
    .addErrorHandlers(ErrorHandler)
    .create();

const adapter = new ExpressAdapter(skill, true, true);

app.post('/alexa', adapter.getRequestHandlers());

app.listen(port, () => {
    console.log(`🌐 Server is running on port ${port}`);
});
