import dotenv from 'dotenv';
import express from 'express';
import OpenAI from 'openai';
import https from 'https';
import crypto from 'crypto';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware para procesar JSON y verificar la firma de Alexa
app.use(express.json({ verify: verifyAlexaSignature })); 
app.use(express.urlencoded({ extended: true })); 

// Claves de OpenAI
const openaiApiKey = process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.trim() : '';
const openaiOrganization = process.env.OPENAI_ID_ORGANIZATION ? process.env.OPENAI_ID_ORGANIZATION.trim() : '';

if (!openaiApiKey) {
    console.error('Error: La clave de la API de OpenAI no es válida o está vacía.');
    process.exit(1);
}

const openai = new OpenAI({ organization: openaiOrganization, apiKey: openaiApiKey });

/**
 * Endpoint principal de Alexa
 */
app.post('/alexa', async (req, res) => {
    try {
        const intent = req.body?.request?.intent?.name || 'Intent no encontrado';
        console.log(intent);
        
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
            res.json(createAlexaResponse(`Intent no reconocido: ${intent}`));
        }
    } catch (error) {
        console.error('Error general:', error.message);
        res.json(createAlexaResponse('Ocurrió un error. Inténtalo más tarde.'));
    }
});

/**
 * Crea una respuesta de Alexa
 * @param {string} message - Mensaje que se enviará al usuario
 */
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

/**
 * Verifica la firma de la solicitud de Alexa
 * @param {object} req - Objeto de solicitud
 * @param {object} res - Objeto de respuesta
 * @param {Buffer} buf - El buffer del cuerpo de la solicitud
 * @param {string} encoding - Codificación
 */
function verifyAlexaSignature(req, res, buf, encoding) {
    const signatureCertChainUrl = req.headers['signaturecertchainurl'];
    const signature = req.headers['signature'];

    if (!signatureCertChainUrl || !signature) {
        throw new Error('Falta la cabecera signature o signaturecertchainurl.');
    }

    // Verificar la validez de la URL del certificado
    const validCertUrlPattern = /^https:\/\/s3\.amazonaws\.com\/echo\.api\//;
    if (!validCertUrlPattern.test(signatureCertChainUrl)) {
        throw new Error('URL de certificado no válida.');
    }

    getCertificate(signatureCertChainUrl)
        .then((cert) => {
            // Verificar la firma usando el certificado y el cuerpo de la solicitud
            const verifier = crypto.createVerify('SHA256');
            verifier.update(buf);
            const isValid = verifier.verify(cert, signature, 'base64');
            
            if (!isValid) {
                throw new Error('Firma de la solicitud no válida.');
            }
        })
        .catch((error) => {
            console.error('Error en la verificación de la firma:', error.message);
            throw new Error('La firma de la solicitud no es válida.');
        });
}

/**
 * Obtiene el certificado de Alexa desde la URL proporcionada
 * @param {string} url - URL del certificado
 * @returns {Promise<string>} - Certificado en formato de texto
 */
function getCertificate(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            let certData = '';
            
            response.on('data', (chunk) => {
                certData += chunk;
            });

            response.on('end', () => {
                resolve(certData);
            });

            response.on('error', (error) => {
                reject(new Error('Error al obtener el certificado de Alexa.'));
            });
        }).on('error', (error) => {
            reject(new Error('Error al conectar con la URL del certificado.'));
        });
    });
}

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
