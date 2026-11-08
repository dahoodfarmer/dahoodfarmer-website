export async function insertContact(db, { name, email, subject, message, ip }) {
  return db.prepare('INSERT INTO contacts (name, email, subject, message, ip_address) VALUES (?,?,?,?,?)').bind(name, email, subject || '', message, ip || null).run();
}
export async function insertBooking(db, { name, email, organization, inquiry_type, preferred_date, details, ip }) {
  return db.prepare('INSERT INTO bookings (name, email, organization, inquiry_type, preferred_date, details, ip_address) VALUES (?,?,?,?,?,?,?)').bind(name, email, organization || '', inquiry_type, preferred_date || '', details || '', ip || null).run();
}
export async function insertSubscriber(db, email) {
  return db.prepare('INSERT OR IGNORE INTO newsletter_subscribers (email) VALUES (?)').bind(email).run();
}
export async function getStats(db) {
  const [contacts, newContacts, bookings, newBookings, subscribers] = await Promise.all([
    db.prepare('SELECT COUNT(*) as c FROM contacts').first(),
    db.prepare("SELECT COUNT(*) as c FROM contacts WHERE status='new'").first(),
    db.prepare('SELECT COUNT(*) as c FROM bookings').first(),
    db.prepare("SELECT COUNT(*) as c FROM bookings WHERE status='new'").first(),
    db.prepare("SELECT COUNT(*) as c FROM newsletter_subscribers WHERE status='active'").first(),
  ]);
  return {
    totalContacts: contacts?.c || 0, newContacts: newContacts?.c || 0,
    totalBookings: bookings?.c || 0, newBookings: newBookings?.c || 0,
    activeSubscribers: subscribers?.c || 0,
  };
}
