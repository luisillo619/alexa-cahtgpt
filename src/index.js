import dotenv from 'dotenv';
import express from 'express';
import { ExpressAdapter } from 'ask-sdk-express-adapter';
import { SkillBuilders } from 'ask-sdk-core';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

const openaiApiKey = process.env.OPENAI_API_KEY.trim();
const openai = new OpenAI({ apiKey: openaiApiKey });

const ChatHandler = {
    canHandle(handlerInput) {
        return true; 
    },
    async handle(handlerInput) {
        try {
            console.log('📡 Tipo de solicitud:', handlerInput.requestEnvelope.request.type);

            const userQuery = handlerInput.requestEnvelope.request.intent?.slots?.query?.value || 'No se recibió una consulta';
            console.log(`📨 Slot recibido: ${userQuery}`);

            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: userQuery }],
                max_tokens: 150
            });

            const chatGptResponse = response?.choices?.[0]?.message?.content || 'No se recibió respuesta de OpenAI';
            console.log(`💬 Respuesta de ChatGPT: ${chatGptResponse}`);

            return handlerInput.responseBuilder
                .speak(chatGptResponse)
                .getResponse();
        } catch (error) {
            console.error('❌ Error en el controlador:', error);
            return handlerInput.responseBuilder
                .speak('Ocurrió un error inesperado, por favor intenta nuevamente.')
                .getResponse();
        }
    }
};

const ErrorHandler = {
    canHandle() { return true; },
    handle(handlerInput, error) {
        console.error('❌ Error no capturado:', error);
        return handlerInput.responseBuilder
            .speak('Ocurrió un error inesperado.')
            .getResponse();
    }
};

const skill = SkillBuilders.custom()
    .addRequestHandlers(ChatHandler)
    .addErrorHandlers(ErrorHandler)
    .create();

const adapter = new ExpressAdapter(skill, true, true);

app.use('/alexa', express.raw({ type: 'application/json' }));

app.post('/alexa', adapter.getRequestHandlers());

app.listen(port, () => {
    console.log(`🌐 Server is running on port ${port}`);
});
