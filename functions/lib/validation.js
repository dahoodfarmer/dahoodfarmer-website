export function validateEmail(email) {
  return typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
export function sanitize(str, maxLen = 2000) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLen).replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
}
function isRecord(data) {
  return data !== null && typeof data === 'object' && !Array.isArray(data);
}
export function validateContact(data) {
  const errors = [];
  if (!isRecord(data)) return ['Invalid form data'];
  if (typeof data.name !== 'string' || data.name.trim().length < 2) errors.push('Name is required');
  if (!validateEmail(data.email)) errors.push('Valid email is required');
  if (typeof data.message !== 'string' || data.message.trim().length < 10) errors.push('Message must be at least 10 characters');
  return errors;
}
export function validateBooking(data) {
  const errors = [];
  if (!isRecord(data)) return ['Invalid form data'];
  if (typeof data.name !== 'string' || data.name.trim().length < 2) errors.push('Name is required');
  if (!validateEmail(data.email)) errors.push('Valid email is required');
  if (typeof data.inquiry_type !== 'string' || !data.inquiry_type.trim()) errors.push('Inquiry type is required');
  return errors;
}
export function validateNewsletter(data) {
  if (!isRecord(data)) return ['Invalid form data'];
  return validateEmail(data.email) ? [] : ['Valid email is required'];
}
