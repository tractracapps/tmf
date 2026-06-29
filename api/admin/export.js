const { sql } = require('@vercel/postgres');

function isAuthorized(req) {
  const key = req.headers['x-admin-key'] || req.query.key;
  return Boolean(process.env.ADMIN_KEY) && key === process.env.ADMIN_KEY;
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
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

    const headers = [
      'ID', 'Full Name', 'Email', 'Phone', 'Age Range', 'Gender', 'State',
      'Interests', 'Leadership Interest', 'Declaration Accepted', 'Submitted At',
    ];
    const lines = [headers.join(',')];

    for (const r of rows) {
      lines.push([
        r.id,
        csvEscape(r.full_name),
        csvEscape(r.email),
        csvEscape(r.phone),
        csvEscape(r.age_range),
        csvEscape(r.gender),
        csvEscape(r.state),
        csvEscape(Array.isArray(r.interests) ? r.interests.join('; ') : r.interests),
        csvEscape(r.leadership),
        r.declaration ? 'Yes' : 'No',
        csvEscape(new Date(r.created_at).toISOString()),
      ].join(','));
    }

    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ypim-applications.csv"');
    res.status(200).send(csv);
  } catch (err) {
    console.error('DB export error:', err);
    res.status(500).send('Server error');
  }
};
