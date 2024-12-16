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

// Handlers de la Skill
const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
    },
    handle(handlerInput) {
        console.log('🔄 Lanzando la skill (LaunchRequest)');
        const speakOutput = '¡Hola! Estoy aquí para ayudarte. ¿En qué puedo asistirte hoy?';
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('¿En qué puedo ayudarte hoy?')
            .getResponse();
    }
};

const ChatIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest' && 
               handlerInput.requestEnvelope.request.intent.name === 'chat';
    },
    async handle(handlerInput) {
        const intent = handlerInput.requestEnvelope.request.intent.name;
        console.log(`📝 Intent reconocido: ${intent}`);
        
        const userQuery = handlerInput.requestEnvelope.request.intent.slots?.query?.value || 'No se recibió una consulta.';
        console.log(`📨 Valor del slot "query": ${userQuery}`);

        try {
            console.log('📡 Enviando petición a OpenAI...');

            // Cambia el prompt para forzar una respuesta en texto
            const prompt = `Responde siempre en texto plano sin usar etiquetas de audio ni indicaciones de solo audio. Responde de forma clara. La consulta es: "${userQuery}"`;
            
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 150
            });

            console.log('🔍 Respuesta completa de OpenAI:', JSON.stringify(response, null, 2));
            
            let chatGptResponse = response?.choices?.[0]?.message?.content || 'No se recibió una respuesta válida de OpenAI';
            
            // 🔍 Validar si la respuesta tiene "<Audio only response>" o etiquetas no deseadas
            if (chatGptResponse.includes('<Audio only response>')) {
                console.warn('⚠️ Se detectó una respuesta de "solo audio". Se reemplaza por texto.');
                chatGptResponse = 'Lo siento, no puedo ofrecer una respuesta de solo audio en este momento. ¿Te gustaría preguntar algo más?';
            }

            // 🔍 Eliminar cualquier etiqueta de audio HTML como <audio>...</audio>
            chatGptResponse = chatGptResponse.replace(/<audio[^>]*>(.*?)<\/audio>/g, '');

            // 🔍 Eliminar etiquetas HTML (como <audio> o <p>)
            chatGptResponse = chatGptResponse.replace(/<[^>]*>/g, '');

            // 🔍 Quitar espacios adicionales y limpiar la respuesta
            chatGptResponse = chatGptResponse.trim();

            console.log(`💬 Respuesta de ChatGPT después de la limpieza: "${chatGptResponse}"`);

            return handlerInput.responseBuilder
                .speak(chatGptResponse)
                .reprompt('¿En qué más puedo ayudarte?') // Mantiene la sesión activa
                .getResponse();
        } catch (error) {
            console.error('❌ Error al conectar con la API de OpenAI:', error);
            return handlerInput.responseBuilder
                .speak('Hubo un error al obtener la respuesta de ChatGPT. Por favor, inténtalo de nuevo más tarde.')
                .reprompt('¿Puedo ayudarte con algo más?') // Evita el cierre de sesión
                .getResponse();
        }
    }
};

const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
               handlerInput.requestEnvelope.request.intent.name === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        console.log('⚠️ FallbackIntent: No se entendió la petición del usuario.');
        return handlerInput.responseBuilder
            .speak('Lo siento, no entendí eso. ¿Podrías repetir tu pregunta de otra forma?')
            .reprompt('¿Podrías decirme en qué puedo ayudarte?') // Reprompt para evitar EXCEEDED_MAX_REPROMPTS
            .getResponse();
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
            .reprompt('¿En qué puedo ayudarte?') // Esto mantiene la sesión activa
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
const adapter = new ExpressAdapter(skill, true, true);

// Ruta principal de la skill
app.post('/alexa', adapter.getRequestHandlers());

app.listen(port, () => {
    console.log(`🌐 Server is running on port ${port}`);
});
