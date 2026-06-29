const { sql } = require('@vercel/postgres');

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const TO_EMAIL = 'faith.amanata@tractrac.co';
const FROM_EMAIL = 'tractracnigeria@gmail.com';

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildEmailHtml(data) {
  const row = (label, value) =>
    `<tr><td style="padding:6px 12px;font-weight:600;vertical-align:top">${label}</td><td style="padding:6px 12px">${esc(value)}</td></tr>`;
  return `
    <h2>New YPiM Membership Application</h2>
    <table cellpadding="0" cellspacing="0">
      ${row('Full Name', data.fullName)}
      ${row('Email', data.email)}
      ${row('Phone', data.phone)}
      ${row('Age Range', data.age)}
      ${row('Gender', data.gender)}
      ${row('State', data.state)}
      ${row('Interests', Array.isArray(data.interest) ? data.interest.join(', ') : data.interest)}
      ${row('Interested in Leadership', data.leadership)}
      ${row('Accepted Declaration', data.declaration ? 'Yes' : 'No')}
    </table>
  `;
}

async function saveToDatabase(data) {
  await sql`
    CREATE TABLE IF NOT EXISTS applications (
      id SERIAL PRIMARY KEY,
      full_name TEXT,
      email TEXT,
      phone TEXT,
      age_range TEXT,
      gender TEXT,
      state TEXT,
      interests TEXT[],
      leadership TEXT,
      declaration BOOLEAN,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `;
  await sql`
    INSERT INTO applications (full_name, email, phone, age_range, gender, state, interests, leadership, declaration)
    VALUES (
      ${data.fullName}, ${data.email}, ${data.phone}, ${data.age}, ${data.gender}, ${data.state},
      ${data.interest || []}, ${data.leadership}, ${!!data.declaration}
    )
  `;
}

async function sendNotificationEmail(data) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error('Email service is not configured');
  }
  const brevoRes = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'YPiM Apply Form', email: FROM_EMAIL },
      to: [{ email: TO_EMAIL, name: 'Faith Amanata' }],
      subject: `New YPiM Membership Application - ${data.fullName || 'Unknown'}`,
      htmlContent: buildEmailHtml(data),
    }),
  });
  if (!brevoRes.ok) {
    const errText = await brevoRes.text();
    throw new Error(errText);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const data = req.body || {};

  let dbError = null;
  try {
    await saveToDatabase(data);
  } catch (err) {
    console.error('DB insert error:', err);
    dbError = err;
  }

  let emailError = null;
  try {
    await sendNotificationEmail(data);
  } catch (err) {
    console.error('Email send error:', err);
    emailError = err;
  }

  if (dbError && emailError) {
    res.status(500).send('Failed to save application');
    return;
  }

  res.status(200).json({ ok: true });
};
