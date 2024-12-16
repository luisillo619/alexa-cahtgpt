import dotenv from 'dotenv';
import express from 'express';
import OpenAI from 'openai';
import * as https from 'https';
import * as crypto from 'crypto';


dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware para procesar JSON
app.use(express.json({ verify: verifyAlexaSignature })); 
app.use(express.urlencoded({ extended: true })); 

// Asegurarse de limpiar la API Key y la Organización
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

// Ruta principal para solicitudes de Alexa
app.post('/alexa', async (req, res) => {
    try {
        if (!req.body) {
            throw new Error('El cuerpo de la solicitud está vacío o no definido.');
        }

        console.log('Encabezados de la solicitud:', JSON.stringify(req.headers, null, 2));
        console.log('req.body completo:', JSON.stringify(req.body, null, 2));

        const intent = req.body?.request?.intent?.name || 'Intent no encontrado';
        console.log('Intent:', intent);

        if (intent === 'AskChatGptIntent') {
            // Extraer la consulta desde el slot de la intención de Alexa
            const userQuery = req.body?.request?.intent?.slots?.query?.value;
            
            if (!userQuery) {
                console.error('Error: No se proporcionó ninguna consulta en la ranura de la intención.');
                return res.status(400).send('Falta el parámetro "query" en la solicitud.');
            }

            console.log('Consulta extraída de la solicitud de Alexa:', userQuery);
            
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: userQuery }],
                max_tokens: 150,
                temperature: 0.7
            });

            const chatGptResponse = response?.choices?.[0]?.message?.content || 'No se recibió una respuesta válida de OpenAI';
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
    } catch (error) {
        console.error('Error general:', error.message);
        res.status(500).json({
            version: '1.0',
            response: {
                outputSpeech: {
                    type: 'PlainText',
                    text: 'Ocurrió un error. Inténtalo más tarde.'
                },
                shouldEndSession: true
            }
        });
    }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// 🔥 Verifica la firma de la solicitud
function verifyAlexaSignature(req, res, buf, encoding) {
    const signatureCertChainUrl = req.headers['signaturecertchainurl'];
    const signature = req.headers['signature'];

    if (!signatureCertChainUrl || !signature) {
        throw new Error('Falta la cabecera signature o signaturecertchainurl.');
    }

    if (!/^https:\/\/s3\.amazonaws\.com\/echo\.api\//.test(signatureCertChainUrl)) {
        throw new Error('URL de certificado no válida.');
    }

    https.get(signatureCertChainUrl, (response) => {
        let cert = '';

        response.on('data', (chunk) => {
            cert += chunk;
        });

        response.on('end', () => {
            const verifier = crypto.createVerify('SHA256');
            verifier.update(buf);
            const isValid = verifier.verify(cert, signature, 'base64');
            if (!isValid) {
                throw new Error('Firma de la solicitud no válida.');
            }
        });
    });
}
