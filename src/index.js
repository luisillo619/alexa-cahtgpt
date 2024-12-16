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

const ChatHandler = {
    canHandle(handlerInput) {
        return true; // Siempre acepta todas las solicitudes
    },
    async handle(handlerInput) {
        const requestType = handlerInput.requestEnvelope.request.type || 'No especificado';
        const intentName = handlerInput.requestEnvelope.request.intent?.name || 'No especificado';
        console.log(`🔍 Tipo de solicitud: ${requestType}`);
        console.log(`🎯 Intent recibido: ${intentName}`);

        // Verifica si la solicitud es de tipo SessionEndedRequest
        if (requestType === 'SessionEndedRequest') {
            const reason = handlerInput.requestEnvelope.request.reason || 'Desconocido';
            console.log(`⚠️ La sesión ha finalizado. Razón: ${reason}`);
            return handlerInput.responseBuilder.getResponse();
        }

        const userQuery = handlerInput.requestEnvelope.request.intent?.slots?.query?.value || 'No se recibió una consulta.';
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
                .reprompt('¿En qué más puedo ayudarte?') // Mantiene la sesión activa
                .getResponse();
        } catch (error) {
            console.error('❌ Error al conectar con la API de OpenAI:', error);
            return handlerInput.responseBuilder
                .speak('Hubo un error al obtener la respuesta de ChatGPT. Por favor, inténtalo de nuevo más tarde.')
                .reprompt('¿Puedo ayudarte con algo más?') // Mantiene la sesión activa
                .getResponse();
        }
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
            .reprompt('¿En qué puedo ayudarte?') // Mantiene la sesión activa
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
        ChatHandler // Solo 1 handler que maneja todas las solicitudes
    )
    .addErrorHandlers(ErrorHandler)
    .create();

// ===============================
// 🔥 Express Adapter para la Skill
// ===============================

const adapter = new ExpressAdapter(skill, false, false); 

// Usa express.raw() para capturar el cuerpo de la solicitud
app.use('/alexa', express.raw({ type: 'application/json' }));

// Interceptar todas las solicitudes para ver el cuerpo completo de la solicitud antes de procesarla
app.post('/alexa', (req, res, next) => {
    console.log('📦 Cuerpo completo de la solicitud (sin procesar):', req.body.toString());
    next();
}, adapter.getRequestHandlers());

// Capturar errores de inicialización del servidor
app.listen(port, () => {
    console.log(`🌐 Server is running on port ${port}`);
}).on('error', (err) => {
    console.error('❌ Error al iniciar el servidor:', err);
});
