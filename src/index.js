import dotenv from 'dotenv';
import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';

dotenv.config();

const app = express();
app.use(bodyParser.json());

const port = process.env.PORT || 3000;
const openaiApiKey = process.env.OPENAI_API_KEY;

// Endpoint de prueba
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Endpoint que procesa la solicitud de Alexa
app.post('/alexa', async (req, res) => {
    console.log("pepe");
    
    const intent = req.body?.request?.intent?.name;
    console.log(intent);
    
    if (intent === 'AskChatGptIntent') {
        const userMessage = req.body?.request?.intent?.slots?.query?.value || "";

        try {
            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-4',
                messages: [{ role: 'user', content: userMessage }],
                max_tokens: 100,
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            });

            const chatGptResponse = response.data.choices[0].message.content;

            res.json({
                version: '1.0',
                response: {
                    outputSpeech: {
                        type: 'PlainText',
                        text: chatGptResponse,
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
                        text: 'Ocurrió un error. Inténtalo de nuevo.',
                    },
                    shouldEndSession: true
                }
            });
        }
    }
     res.status(500).json({});
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
