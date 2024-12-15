import dotenv from 'dotenv';
import express from 'express';
import axios from 'axios';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware para procesar JSON
app.use(express.json()); // 🔥 Mejor opción que bodyParser
app.use(express.urlencoded({ extended: true })); // Opcional, si necesitas datos de formularios

const openaiApiKey = process.env.OPENAI_API_KEY;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.post('/alexa', async (req, res) => {
    // Verifica si req.body existe antes de encadenar
    if (!req.body) {
      console.error('Error: req.body está vacío o undefined');
      return res.status(400).send('No se recibieron datos en el cuerpo de la solicitud');
    }

    // 🔥 Muestra los encabezados de la solicitud
    console.log('Encabezados de la solicitud:', JSON.stringify(req.headers, null, 2));

    // 🔥 Muestra el contenido de req.body COMPLETO
    console.log('req.body completo:', JSON.stringify(req.body, null, 2));

    // Captura el intent
    const intent = req.body?.request?.intent?.name || 'Intent no encontrado';
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
            console.log('Respuesta de ChatGPT:', chatGptResponse); // 🔥 Consologuear la respuesta de OpenAI
            res.json({ response: chatGptResponse });
        } catch (error) {
            console.error('Error al conectar con la API de OpenAI:', error);
            res.status(500).send('Error interno del servidor');
        }
    } else {
        res.status(400).send(`Intent no reconocido: ${intent}`);
    }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
