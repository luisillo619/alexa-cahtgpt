import dotenv from 'dotenv';
import express from 'express';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware para procesar JSON
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 

// Asegurar que la API Key es válida
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

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.post('/alexa', async (req, res) => {
    if (!req.body) {
        console.error('Error: req.body está vacío o undefined');
        return res.status(400).send('No se recibieron datos en el cuerpo de la solicitud');
    }

    console.log('Encabezados de la solicitud:', JSON.stringify(req.headers, null, 2));
    console.log('req.body completo:', JSON.stringify(req.body, null, 2));

    const requestType = req.body.request.type;

    // Manejo del tipo de request
    if (requestType === 'LaunchRequest') {
        // El usuario inició la skill sin hacer una pregunta
        return res.json({
            version: '1.0',
            response: {
                outputSpeech: {
                    type: 'PlainText',
                    text: '¡Hola! Estoy aquí para ayudarte. Si tienes alguna pregunta o tema en mente, no dudes en decírmelo. ¿En qué puedo asistirte hoy?'
                },
                reprompt: {
                    outputSpeech: {
                        type: 'PlainText',
                        text: '¿En qué puedo ayudarte hoy?'
                    }
                },
                shouldEndSession: false  // Dejar la sesión abierta para que el usuario pueda preguntar
            }
        });
    } else if (requestType === 'IntentRequest') {
        const intent = req.body?.request?.intent?.name || 'Intent no encontrado';
        console.log('Intent:', intent);

        if (intent === 'AMAZON.FallbackIntent') {
            // Cuando la skill no entiende la petición del usuario.
            return res.json({
                version: '1.0',
                response: {
                    outputSpeech: {
                        type: 'PlainText',
                        text: 'Lo siento, no entendí eso. ¿Podrías repetir tu pregunta de otra forma?'
                    },
                    reprompt: {
                        outputSpeech: {
                            type: 'PlainText',
                            text: '¿Podrías decirme en qué puedo ayudarte?'
                        }
                    },
                    shouldEndSession: false
                }
            });
        }

        // Extraemos la consulta del slot query, si existe
        const userQuery = req.body?.request?.intent?.slots?.query?.value;
        console.log('Consulta recibida:', userQuery);

        // Si no hay query, usar un mensaje genérico
        let prompt = userQuery || 'No se recibió una consulta. ¿En qué puedo ayudarte?';
        console.log('Prompt enviado a OpenAI:', prompt);

        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 100
            });

            const chatGptResponse = response?.choices?.[0]?.message?.content || 'No se recibió una respuesta válida de OpenAI';
            console.log('Respuesta de ChatGPT:', chatGptResponse);

            return res.json({
                version: '1.0',
                response: {
                    outputSpeech: {
                        type: 'PlainText',
                        text: chatGptResponse
                    },
                    reprompt: {
                        outputSpeech: {
                            type: 'PlainText',
                            text: '¿En qué más puedo ayudarte?'
                        }
                    },
                    shouldEndSession: false // Mantener false para permitir más interacción
                }
            });
        } catch (error) {
            console.error('Error al conectar con la API de OpenAI:', error.response?.data || error);
            return res.status(500).json({
                version: '1.0',
                response: {
                    outputSpeech: {
                        type: 'PlainText',
                        text: 'Hubo un error al obtener la respuesta de ChatGPT. Por favor, inténtalo de nuevo más tarde.'
                    },
                    shouldEndSession: true
                }
            });
        }

    } else if (requestType === 'SessionEndedRequest') {
        // La sesión terminó, no respondemos nada
        return res.status(200).send();
    } else {
        // Caso no contemplado (por ejemplo, otro tipo de request)
        return res.json({
            version: '1.0',
            response: {
                outputSpeech: {
                    type: 'PlainText',
                    text: 'No entendí tu solicitud.'
                },
                reprompt: {
                    outputSpeech: {
                        type: 'PlainText',
                        text: '¿Podrías decirme en qué puedo ayudarte?'
                    }
                },
                shouldEndSession: false
            }
        });
    }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
