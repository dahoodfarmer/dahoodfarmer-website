import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/receipt/[token].js';
import { createReceiptToken } from '../functions/lib/payment-receipts.js';
import { hashInvoiceToken } from '../functions/lib/invoices.js';

const secret='receipt-route-test-secret-at-least-32-chars';
function dbFor(receipt){return{prepare(sql){return{bind(){return{async first(){return receipt}}}}}}}

test('serves a no-index printable receipt for a valid opaque token',async()=>{
 const token=await createReceiptToken('inv-123',secret);
 const receipt={receipt_id:'DHF-20261117-ABCDEF12',recipient_name:'Buyer',recipient_email:'buyer@example.com',business_name:'Example Co',description:'Sponsor package',amount_cents:50000,currency:'usd',payment_method:'card',provider_id:'stripe',provider_reference:'pi_test',paid_at:'2026-11-17T12:00:00.000Z'};
 const response=await onRequestGet({params:{token},env:{DB:dbFor(receipt)}});
 const html=await response.text();
 assert.equal(response.status,200);
 assert.match(response.headers.get('Cache-Control'),/no-store/);
 assert.match(response.headers.get('X-Robots-Tag'),/noindex/);
 assert.match(html,/DHF-20261117-ABCDEF12/);
 assert.match(html,/Print \/ Save PDF/);
});

test('does not reveal a receipt for invalid or unknown tokens',async()=>{
 const response=await onRequestGet({params:{token:'not-a-valid-receipt-token'},env:{DB:dbFor(null)}});
 assert.equal(response.status,404);
 assert.equal(await response.text(),'Receipt not found.');
});

test('escapes customer-controlled text in the receipt page',async()=>{
 const token=await createReceiptToken('inv-123',secret);
 const receipt={receipt_id:'DHF-20261117-ABCDEF12',recipient_name:'<script>alert(1)</script>',recipient_email:'buyer@example.com',business_name:'Example Co',description:'Sponsor package',amount_cents:50000,currency:'usd',payment_method:null,provider_id:'manual',provider_reference:'',paid_at:'2026-11-17T12:00:00.000Z'};
 const response=await onRequestGet({params:{token},env:{DB:dbFor(receipt)}});
 const html=await response.text();
 assert.equal(html.includes('<script>alert(1)</script>'),false);
 assert.match(html,/&lt;script&gt;/);
});
