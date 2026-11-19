-- Store provider customer references without coupling the sponsor CRM to Stripe.
ALTER TABLE sponsor_partnerships ADD COLUMN provider_customer_id TEXT;
