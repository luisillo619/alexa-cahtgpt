import dotenv from 'dotenv';
import express from 'express';
import OpenAI from 'openai';
import https from 'https';
import crypto from 'crypto';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ verify: verifyAlexaSignature })); 
app.use(express.urlencoded({ extended: true })); 

const openaiApiKey = process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.trim() : '';
const openaiOrganization = process.env.OPENAI_ID_ORGANIZATION ? process.env.OPENAI_ID_ORGANIZATION.trim() : '';

if (!openaiApiKey) {
    console.error('Error: La clave de la API de OpenAI no es válida o está vacía.');
    process.exit(1);
}

const openai = new OpenAI({ organization: openaiOrganization, apiKey: openaiApiKey });

app.post('/alexa', async (req, res) => {
    try {
        const intent = req.body?.request?.intent?.name || 'Intent no encontrado';
        
        if (intent === 'chat') {
            const userQuery = req.body?.request?.intent?.slots?.query?.value;

            if (!userQuery) {
                return res.json(createAlexaResponse('No se pudo capturar la consulta, por favor intenta de nuevo.'));
            }

            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: userQuery }],
                max_tokens: 150,
                temperature: 0.7
            });

            const chatGptResponse = response?.choices?.[0]?.message?.content || 'No se recibió una respuesta válida de OpenAI';
            res.json(createAlexaResponse(chatGptResponse));

        } else {
            res.json(createAlexaResponse(`${intent}`));
        }
    } catch (error) {
        console.error('Error general:', error.message);
        res.json(createAlexaResponse('Ocurrió un error. Inténtalo más tarde.'));
    }
});

function createAlexaResponse(message) {
    return {
        version: '1.0',
        response: {
            outputSpeech: {
                type: 'PlainText',
                text: message
            },
            shouldEndSession: true
        }
    };
}

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
        response.on('data', (chunk) => { cert += chunk; });
        response.on('end', () => {
            const verifier = crypto.createVerify('SHA256');
            verifier.update(buf);
            const isValid = verifier.verify(cert, signature, 'base64');
            if (!isValid) throw new Error('Firma de la solicitud no válida.');
        });
    });
}

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
