const { sql } = require('@vercel/postgres');

function isAuthorized(req) {
  const key = req.headers['x-admin-key'] || req.query.key;
  return Boolean(process.env.ADMIN_KEY) && key === process.env.ADMIN_KEY;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  if (!isAuthorized(req)) {
    res.status(401).send('Unauthorized');
    return;
  }

  try {
    const { rows } = await sql`
      SELECT id, full_name, email, phone, age_range, gender, state, interests, leadership, declaration, created_at
      FROM applications
      ORDER BY created_at DESC
    `;
    res.status(200).json({ submissions: rows });
  } catch (err) {
    console.error('DB read error:', err);
    res.status(500).send('Server error');
  }
};
