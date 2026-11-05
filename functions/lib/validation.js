export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}
export function sanitize(str, maxLen = 2000) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLen).replace(/<script[^>]*>.*?<\/script>/gi, '');
}
export function validateContact(data) {
  const errors = [];
  if (!data.name || data.name.trim().length < 2) errors.push('Name is required');
  if (!data.email || !validateEmail(data.email)) errors.push('Valid email is required');
  if (!data.message || data.message.trim().length < 10) errors.push('Message must be at least 10 characters');
  return errors;
}
export function validateBooking(data) {
  const errors = [];
  if (!data.name || data.name.trim().length < 2) errors.push('Name is required');
  if (!data.email || !validateEmail(data.email)) errors.push('Valid email is required');
  if (!data.inquiry_type) errors.push('Inquiry type is required');
  return errors;
}
export function validateNewsletter(data) {
  const errors = [];
  if (!data.email || !validateEmail(data.email)) errors.push('Valid email is required');
  return errors;
}
