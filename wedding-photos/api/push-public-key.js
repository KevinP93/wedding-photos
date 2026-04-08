const { configureWebPush } = require('./_push');

module.exports = async function handler(_req, res) {
  res.setHeader('Content-Type', 'application/json');

  try {
    const { publicKey } = configureWebPush();
    res.status(200).json({ publicKey });
  } catch (error) {
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Clé VAPID publique indisponible.'
      }
    });
  }
};
