import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOpportunityApplication } from '../functions/lib/opportunity.js';

const base = {
  application_type: 'business_listing',
  name: 'Erin Carter',
  email: 'erin@example.com',
  organization: 'DHF Example Farm',
  website: 'https://example.com',
  country: 'United States',
  region: 'South Carolina',
  city: 'Columbia',
  category: 'Agriculture',
  requested_package: 'Founding business listing',
  event_interest: '',
  preferred_date: '',
  message: 'We would like to be considered for the directory.',
  public_description: 'A family-operated farm offering specialty crops and agricultural education.',
  contact_consent: true,
  marketing_consent: false,
  public_listing_consent: true
};

test('accepts a valid business listing application and records the source path', () => {
  const result = validateOpportunityApplication(base, '/business-directory');
  assert.equal(result.valid, true);
  assert.equal(result.sanitized.application_type, 'business_listing');
  assert.equal(result.sanitized.email, 'erin@example.com');
  assert.equal(result.sanitized.source_path, '/business-directory');
  assert.equal(result.sanitized.public_listing_consent, true);
});

test('accepts every supported application type', () => {
  const types = ['business_listing', 'vendor', 'sponsor', 'speaker', 'academy', 'property_partner', 'membership'];
  for (const application_type of types) {
    const result = validateOpportunityApplication({ ...base, application_type }, '/marketplace');
    assert.equal(result.valid, true, application_type);
  }
});

test('rejects unknown application types', () => {
  const result = validateOpportunityApplication({ ...base, application_type: 'admin' }, '/business');
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /application type/i);
});

test('requires applicant name, valid email, country, message and contact consent', () => {
  const result = validateOpportunityApplication({
    ...base,
    name: ' ',
    email: 'not-an-email',
    country: '',
    message: '',
    contact_consent: false
  }, '/summits');
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => /name/i.test(e)));
  assert.ok(result.errors.some((e) => /email/i.test(e)));
  assert.ok(result.errors.some((e) => /country/i.test(e)));
  assert.ok(result.errors.some((e) => /message/i.test(e)));
  assert.ok(result.errors.some((e) => /contact/i.test(e)));
});

test('accepts email local parts containing the letter s and rejects whitespace', () => {
  const good = validateOpportunityApplication({ ...base, email: 'sales@example.com' }, '/sponsors');
  assert.equal(good.valid, true);
  const bad = validateOpportunityApplication({ ...base, email: 'sales team@example.com' }, '/sponsors');
  assert.equal(bad.valid, false);
});

test('accepts international Unicode names and regions without US-only restrictions', () => {
  const result = validateOpportunityApplication({
    ...base,
    name: 'José da Silva',
    organization: 'Café São Paulo',
    country: 'Brazil',
    region: 'São Paulo',
    city: 'Campinas'
  }, '/experiences');
  assert.equal(result.valid, true);
  assert.equal(result.sanitized.name, 'José da Silva');
  assert.equal(result.sanitized.region, 'São Paulo');
  assert.equal(result.sanitized.country, 'Brazil');
});

test('keeps marketing consent separate and defaults it to false', () => {
  const { marketing_consent, ...withoutMarketing } = base;
  const result = validateOpportunityApplication(withoutMarketing, '/academy');
  assert.equal(result.valid, true);
  assert.equal(result.sanitized.marketing_consent, false);
});

test('requires a separate public description when a business listing requests publication', () => {
  const result = validateOpportunityApplication({ ...base, public_description: '' }, '/business-directory');
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /public description/i);
});

test('public listing consent is optional and defaults to false', () => {
  const { public_listing_consent, ...withoutPublicListing } = base;
  const result = validateOpportunityApplication(withoutPublicListing, '/business-directory');
  assert.equal(result.valid, true);
  assert.equal(result.sanitized.public_listing_consent, false);
});

test('rejects unsupported website protocols', () => {
  const result = validateOpportunityApplication({ ...base, website: 'javascript:alert(1)' }, '/business');
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /website/i);
});

test('enforces field length limits rather than silently storing oversized payloads', () => {
  const result = validateOpportunityApplication({ ...base, message: 'x'.repeat(5001) }, '/sponsors');
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /message/i);
});

test('normalizes the source path and rejects non-path input', () => {
  const good = validateOpportunityApplication(base, '/sponsors?utm_source=ignored');
  assert.equal(good.valid, true);
  assert.equal(good.sanitized.source_path, '/sponsors');
  const bad = validateOpportunityApplication(base, 'https://attacker.example/');
  assert.equal(bad.valid, true);
  assert.equal(bad.sanitized.source_path, '/');
});
