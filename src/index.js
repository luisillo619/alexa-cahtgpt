import dotenv from 'dotenv';
import express from 'express';
import axios from 'axios';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware para procesar JSON
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 

const openaiApiKey = process.env.OPENAI_API_KEY;

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

    const intent = req.body?.request?.intent?.name || 'Intent no encontrado';
    console.log('Intent:', intent);

    if (intent === 'AskChatGptIntent') {
        try {
            const userQuery = req.body?.request?.intent?.slots?.query?.value;
            
            if (!userQuery) {
                console.error('Error: No se proporcionó ninguna consulta en la ranura de la intención.');
                return res.status(400).send('Falta el parámetro "query" en la solicitud.');
            }

            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-4',
                messages: [{ role: 'user', content: userQuery }],
                max_tokens: 100,
            }, {
                headers: {
                    'Authorization': `Bearer ${openaiApiKey.trim()}`, // Solución al error de caracteres inválidos en la autorización
                    'Content-Type': 'application/json',
                },
            });

            const chatGptResponse = response?.data?.choices?.[0]?.message?.content || 'No se recibió una respuesta válida de OpenAI';
            console.log('Respuesta de ChatGPT:', chatGptResponse);
            
            res.json({
                version: '1.0',
                response: {
                    outputSpeech: {
                        type: 'PlainText',
                        text: chatGptResponse
                    },
                    shouldEndSession: true
                }
            });
        } catch (error) {
            console.error('Error al conectar con la API de OpenAI:', error);
            res.status(500).json({
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
    } else {
        res.status(400).json({
            version: '1.0',
            response: {
                outputSpeech: {
                    type: 'PlainText',
                    text: `Intent no reconocido: ${intent}`
                },
                shouldEndSession: true
            }
        });
    }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});