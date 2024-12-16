import dotenv from 'dotenv';
import express from 'express';
import OpenAI from 'openai';
import crypto from 'crypto';
import https from 'https';
import url from 'url';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Verifica que la URL de la cadena de certificados sea válida
const isValidCertUrl = (urlString) => {
    const parsedUrl = url.parse(urlString);
    return (
        parsedUrl.protocol === 'https:' &&
        parsedUrl.hostname === 's3.amazonaws.com' &&
        parsedUrl.pathname.startsWith('/echo.api/')
    );
};

// Verifica la firma de la solicitud
const verifySignature = (signatureCertChainUrl, signature, body) => {
    return new Promise((resolve, reject) => {
        if (!isValidCertUrl(signatureCertChainUrl)) {
            return reject(new Error('URL de la cadena de certificados no válida.'));
        }

        https.get(signatureCertChainUrl, (res) => {
            let certData = '';
            res.on('data', (chunk) => (certData += chunk));
            res.on('end', () => {
                try {
                    const verifier = crypto.createVerify('SHA256');
                    verifier.update(body, 'utf8');
                    const isValid = verifier.verify(certData, signature, 'base64');
                    if (isValid) {
                        resolve(true);
                    } else {
                        reject(new Error('La firma de la solicitud no es válida.'));
                    }
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', (error) => reject(error));
    });
};

// Verifica si el timestamp está dentro de un intervalo aceptable (150 segundos)
const isRequestTimestampValid = (requestTimestamp) => {
    const requestTime = new Date(requestTimestamp).getTime();
    const currentTime = new Date().getTime();
    const differenceInSeconds = Math.abs(currentTime - requestTime) / 1000;
    return differenceInSeconds <= 150;
};

app.post('/alexa', async (req, res) => {
    console.log('===== NUEVA PETICIÓN A /alexa =====');
    const signatureCertChainUrl = req.headers['signaturecertchainurl']?.replace(';', ''); // Limpia la URL del ';'
    const signature = req.headers['signature'];

    try {
        // Verificar la firma
        await verifySignature(signatureCertChainUrl, signature, JSON.stringify(req.body));
        console.log('✅ La firma de la solicitud de Alexa es válida.');

        // Verificar la validez del timestamp
        if (!isRequestTimestampValid(req.body.request.timestamp)) {
            throw new Error('El timestamp de la solicitud no es válido o ha caducado.');
        }

    } catch (error) {
        console.error('❌ Error de validación de la solicitud de Alexa:', error.message);
        return res.status(403).send('La solicitud no es válida.');
    }

    if (!req.body) {
        console.error('❌ Error: req.body está vacío o undefined');
        return res.status(400).send('No se recibieron datos en el cuerpo de la solicitud');
    }

    console.log('Encabezados de la solicitud:', JSON.stringify(req.headers, null, 2));
    console.log('Cuerpo completo de la solicitud (req.body):', JSON.stringify(req.body, null, 2));

    const requestType = req.body.request.type;
    console.log(`Tipo de request recibido: ${requestType}`);

    if (requestType === 'LaunchRequest') {
        console.log('🔄 Lanzando skill sin pregunta (LaunchRequest)');
        return res.json({
            version: '1.0',
            response: {
                outputSpeech: {
                    type: 'PlainText',
                    text: '¡Hola! Estoy aquí para ayudarte. ¿En qué puedo asistirte hoy?'
                },
                shouldEndSession: false
            }
        });
    }

    if (requestType === 'IntentRequest') {
        const intent = req.body?.request?.intent?.name || 'Intent no encontrado';
        console.log(`Intent reconocido: ${intent}`);

        const userQuery = req.body?.request?.intent?.slots?.query?.value || 'No se recibió una consulta.';
        console.log(`Valor del slot "query": ${userQuery}`);

        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: userQuery }],
                max_tokens: 100
            });
            const chatGptResponse = response?.choices?.[0]?.message?.content || 'No se recibió una respuesta válida de OpenAI';
            console.log(`Respuesta de ChatGPT: "${chatGptResponse}"`);
            
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
            console.error('❌ Error al conectar con la API de OpenAI:', error);
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
    }

    if (requestType === 'SessionEndedRequest') {
        console.log('💤 SessionEndedRequest recibido, la sesión ha terminado.');
        return res.status(200).send();
    }

    console.log(`⚠️ Tipo de request no contemplado: ${requestType}`);
    return res.json({
        version: '1.0',
        response: {
            outputSpeech: {
                type: 'PlainText',
                text: 'No entendí tu solicitud.'
            },
            shouldEndSession: false
        }
    });
});

app.listen(port, () => {
    console.log(`🌐 Server is running on port ${port}`);
});
