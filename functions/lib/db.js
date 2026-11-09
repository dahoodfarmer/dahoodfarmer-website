async function tableColumns(db, table) {
  const result = await db.prepare(`PRAGMA table_info(${table})`).all();
  return new Set((result.results || []).map((column) => column.name));
}

function insertStatement(db, table, values, ignoreConflict = false) {
  const columns = Object.keys(values);
  const placeholders = columns.map(() => '?').join(', ');
  return db.prepare(`INSERT ${ignoreConflict ? 'OR IGNORE ' : ''}INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`).bind(...columns.map((column) => values[column])).run();
}

export async function insertContact(db, { name, email, subject, message, ip }) {
  return db.prepare('INSERT INTO contacts (name, email, subject, message, ip_address) VALUES (?,?,?,?,?)')
    .bind(name, email, subject || '', message, ip || null).run();
}

export async function insertBooking(db, { name, email, organization, inquiry_type, preferred_date, details, ip }) {
  const columns = await tableColumns(db, 'bookings');
  const values = { name, email, inquiry_type };
  if (columns.has('organization')) values.organization = organization || '';
  if (columns.has('preferred_date')) values.preferred_date = preferred_date || '';
  if (columns.has('details')) values.details = details || '';
  if (columns.has('ip_address')) values.ip_address = ip || null;
  const required = ['name', 'email', 'inquiry_type'];
  const missing = required.filter((column) => !columns.has(column));
  if (missing.length) throw new Error(`bookings table is missing required columns: ${missing.join(', ')}`);
  return insertStatement(db, 'bookings', values);
}

export async function insertSubscriber(db, email) {
  const columns = await tableColumns(db, 'newsletter_subscribers');
  if (!columns.has('email')) throw new Error('newsletter_subscribers table is missing required column: email');

  const now = new Date().toISOString();
  const mutableValues = {};
  if (columns.has('unsubscribe_token')) mutableValues.unsubscribe_token = crypto.randomUUID();
  if (columns.has('consent_at')) mutableValues.consent_at = now;
  if (columns.has('status')) mutableValues.status = 'active';
  if (columns.has('subscribed_at')) mutableValues.subscribed_at = now;

  const existing = await db.prepare('SELECT * FROM newsletter_subscribers WHERE email = ?').bind(email).first();
  const existingStatus = columns.has('status') ? existing?.status : (existing ? 'active' : null);
  if (existing && existingStatus === 'active') return { action: 'already_subscribed' };

  async function reactivate() {
    const updates = Object.keys(mutableValues);
    if (updates.length) {
      const assignments = updates.map((column) => `${column} = ?`).join(', ');
      await db.prepare(`UPDATE newsletter_subscribers SET ${assignments} WHERE email = ?`)
        .bind(...updates.map((column) => mutableValues[column]), email).run();
    }
    return { action: 'reactivated' };
  }

  if (existing) return reactivate();

  const values = { email, ...mutableValues };
  const result = await insertStatement(db, 'newsletter_subscribers', values, true);
  if (result?.meta?.changes > 0) return { action: 'inserted' };

  // A concurrent signup may have inserted this email after the initial read.
  // Re-read and treat the duplicate as already subscribed or reactivate it.
  const concurrent = await db.prepare('SELECT * FROM newsletter_subscribers WHERE email = ?').bind(email).first();
  if (!concurrent) throw new Error('Newsletter insert was ignored without an existing subscriber row');
  const concurrentStatus = columns.has('status') ? concurrent.status : 'active';
  if (concurrentStatus === 'active') return { action: 'already_subscribed' };
  return reactivate();
}

export async function getStats(db) {
  const [contacts, newContacts, bookings, newBookings, subscribers] = await Promise.all([
    db.prepare('SELECT COUNT(*) as c FROM contacts').first(),
    db.prepare("SELECT COUNT(*) as c FROM contacts WHERE status='new'").first(),
    db.prepare('SELECT COUNT(*) as c FROM bookings').first(),
    db.prepare("SELECT COUNT(*) as c FROM bookings WHERE status='new'").first(),
    db.prepare("SELECT COUNT(*) as c FROM newsletter_subscribers WHERE status='active'").first(),
  ]);
  return { totalContacts: contacts?.c || 0, newContacts: newContacts?.c || 0, totalBookings: bookings?.c || 0, newBookings: newBookings?.c || 0, activeSubscribers: subscribers?.c || 0 };
}
