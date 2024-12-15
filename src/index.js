import dotenv from 'dotenv';
import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';

dotenv.config();

const app = express();
app.use(bodyParser.json());

const port = 3000;
const openaiApiKey = process.env.OPENAI_API_KEY;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.post('/chat', async (req, res) => {
    console.log("pepe");

    // Verifica si req.body existe antes de encadenar
    const intent = req.body?.request?.intent?.name;
    console.log('Intent:', intent);

    if (intent === 'AskChatGptIntent') {
        try {
            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-4o',
                messages: [{ role: 'user', content: req.body.message }],
                max_tokens: 100,
            }, {
                headers: {
                    'Authorization': `Bearer ${openaiApiKey}`,
                    'Content-Type': 'application/json',
                },
            });

            const chatGptResponse = response.data.choices[0].message.content;
            res.json({ response: chatGptResponse });
        } catch (error) {
            console.error('Error al conectar con la API de OpenAI:', error);
            res.status(500).send('Error interno del servidor');
        }
    } else {
        res.status(400).send('Intent no reconocido');
    }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
