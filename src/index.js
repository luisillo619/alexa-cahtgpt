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

    const requestType = req.body.request.type;
    console.log('Tipo de request:', requestType);
    console.log('Request completa:', JSON.stringify(req.body, null, 2));

    let userQuery;

    if (requestType === 'LaunchRequest') {
      // El usuario abre la skill sin decir nada específico
      return res.json({
        version: '1.0',
        response: {
          outputSpeech: {
            type: 'PlainText',
            text: 'Hola, soy tu asistente pro. Puedes preguntarme lo que quieras. ¿Qué deseas saber?'
          },
          shouldEndSession: false
        }
      });
    } else if (requestType === 'IntentRequest') {
      const intentName = req.body.request.intent.name;
      console.log('Intent:', intentName);
      userQuery = req.body?.request?.intent?.slots?.query?.value;

      // Si no hay query y es la FallbackIntent, pide al usuario que reformule
      if (intentName === 'AMAZON.FallbackIntent') {
        return res.json({
          version: '1.0',
          response: {
            outputSpeech: {
              type: 'PlainText',
              text: 'No estoy seguro de lo que quieres. ¿Podrías repetir tu pregunta?'
            },
            shouldEndSession: false
          }
        });
      }

      // Si no hay query, usar un prompt genérico
      if (!userQuery) {
        userQuery = 'No se recibió ninguna pregunta específica.';
      }

      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: userQuery }],
          max_tokens: 100
        });

        const chatGptResponse = response?.choices?.[0]?.message?.content || 'Lo siento, no tengo respuesta en este momento.';
        console.log('Respuesta de ChatGPT:', chatGptResponse);

        return res.json({
          version: '1.0',
          response: {
            outputSpeech: {
              type: 'PlainText',
              text: chatGptResponse
            },
            shouldEndSession: false
          }
        });
      } catch (error) {
        console.error('Error al conectar con la API de OpenAI:', error.response?.data || error);
        return res.status(500).json({
          version: '1.0',
          response: {
            outputSpeech: {
              type: 'PlainText',
              text: 'Hubo un error al obtener la respuesta. Por favor, inténtalo de nuevo más tarde.'
            },
            shouldEndSession: true
          }
        });
      }
    } else if (requestType === 'SessionEndedRequest') {
      // No se responde nada, la sesión ya terminó.
      return res.status(200).send();
    } else {
      // Caso no reconocido: podría ser alguna otra petición
      return res.json({
        version: '1.0',
        response: {
          outputSpeech: {
            type: 'PlainText',
            text: 'No entendí tu solicitud. ¿Podrías repetirla?'
          },
          shouldEndSession: false
        }
      });
    }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
