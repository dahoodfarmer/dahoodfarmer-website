const APPLICATION_TYPES = new Set([
  'business_listing',
  'vendor',
  'sponsor',
  'speaker',
  'academy',
  'property_partner',
  'membership'
]);

const FIELD_LIMITS = {
  name: 100,
  email: 254,
  organization: 200,
  website: 300,
  country: 100,
  region: 100,
  city: 100,
  category: 100,
  requested_package: 120,
  event_interest: 200,
  preferred_date: 50,
  message: 5000
};

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasExcessLength(value, limit) {
  return typeof value === 'string' && value.length > limit;
}

function toConsent(value) {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'on' || value === 'yes';
}

function normalizeSourcePath(sourcePath) {
  if (typeof sourcePath !== 'string') return '/';
  const candidate = sourcePath.trim();
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return '/';
  try {
    const parsed = new URL(candidate, 'https://dahoodfarmer.invalid');
    return parsed.pathname.slice(0, 200) || '/';
  } catch {
    return '/';
  }
}

function normalizeWebsite(value) {
  const website = clean(value);
  if (!website) return '';
  const candidate = /^https?:\/\//i.test(website) ? website : 'https://' + website;
  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname.includes('.')) return null;
    return parsed.toString().slice(0, FIELD_LIMITS.website);
  } catch {
    return null;
  }
}

export function validateOpportunityApplication(data, sourcePath) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errors: ['Invalid application payload'], sanitized: null };
  }

  const applicationType = clean(data.application_type);
  if (!APPLICATION_TYPES.has(applicationType)) errors.push('Valid application type is required');

  for (const [field, limit] of Object.entries(FIELD_LIMITS)) {
    if (hasExcessLength(data[field], limit)) errors.push(field.replaceAll('_', ' ') + ' exceeds ' + limit + ' characters');
  }

  const name = clean(data.name);
  const email = clean(data.email).toLowerCase();
  const organization = clean(data.organization);
  const website = normalizeWebsite(data.website);
  const country = clean(data.country);
  const region = clean(data.region);
  const city = clean(data.city);
  const category = clean(data.category);
  const requestedPackage = clean(data.requested_package);
  const eventInterest = clean(data.event_interest);
  const preferredDate = clean(data.preferred_date);
  const message = clean(data.message);
  const contactConsent = toConsent(data.contact_consent);
  const marketingConsent = toConsent(data.marketing_consent);
  const publicListingConsent = toConsent(data.public_listing_consent);

  if (!name) errors.push('Applicant name is required');
  if (!email) errors.push('Email is required');
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > FIELD_LIMITS.email) errors.push('Valid email is required');
  if (!country) errors.push('Country is required');
  if (!message) errors.push('Message is required');
  if (!contactConsent) errors.push('Consent to be contacted about this application is required');
  if (website === null) errors.push('Website must be a valid http or https address');

  const sanitized = {
    application_type: applicationType,
    name,
    email,
    organization,
    website: website || '',
    country,
    region,
    city,
    category,
    requested_package: requestedPackage,
    event_interest: eventInterest,
    preferred_date: preferredDate,
    message,
    contact_consent: contactConsent,
    marketing_consent: marketingConsent,
    public_listing_consent: publicListingConsent,
    source_path: normalizeSourcePath(sourcePath)
  };

  return { valid: errors.length === 0, errors, sanitized };
}
