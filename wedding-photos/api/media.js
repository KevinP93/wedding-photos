const crypto = require('node:crypto');

function parseBody(req) {
  if (!req.body) {
    return {};
  }

  if (typeof req.body === 'string') {
    return JSON.parse(req.body);
  }

  return req.body;
}

function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Variables Cloudinary manquantes.');
  }

  return { cloudName, apiKey, apiSecret };
}

function buildSignature(publicId, timestamp, apiSecret) {
  return crypto
    .createHash('sha1')
    .update(`invalidate=true&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest('hex');
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    res.status(405).json({ message: 'Methode non autorisee.' });
    return;
  }

  try {
    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
    const body = parseBody(req);
    const publicId = typeof body.publicId === 'string' ? body.publicId.trim() : '';
    const resourceType = body.resourceType === 'video' ? 'video' : 'image';

    if (!publicId) {
      res.status(400).json({ message: 'publicId manquant.' });
      return;
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = buildSignature(publicId, timestamp, apiSecret);
    const formData = new URLSearchParams();

    formData.set('public_id', publicId);
    formData.set('timestamp', String(timestamp));
    formData.set('invalidate', 'true');
    formData.set('signature', signature);
    formData.set('api_key', apiKey);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      }
    );

    const result = await response.json();
    if (!response.ok || result.error) {
      res.status(response.status || 500).json({
        error: {
          message: result.error?.message || 'Suppression Cloudinary echouee.'
        }
      });
      return;
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Erreur serveur Cloudinary.'
      }
    });
  }
};
