import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/payments/webhook.js';

const record={invoice_id:'inv-1',partnership_id:4,amount_cents:50000};
function fakeDb(){
 const calls=[];
 return {calls,prepare(sql){return{bind(...values){return{
  async first(){calls.push({kind:'first',sql,values});return record},
  async run(){calls.push({kind:'run',sql,values});return{meta:{changes:1}}}
 }}}}};
}
async function signature(payload,secret='whsec_test'){
 const timestamp=Math.floor(Date.now()/1000),encoder=new TextEncoder();
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const digest=await crypto.subtle.sign('HMAC',key,encoder.encode(timestamp+'.'+payload));
 const hex=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
 return 't='+timestamp+',v1='+hex;
}
function eventRequest(payload,header){
 return new Request('https://dahoodfarmer.com/api/payments/webhook',{method:'POST',headers:{'Stripe-Signature':header},body:payload});
}

test('verified invoice.paid webhook marks invoice and partnership paid',async()=>{
 const DB=fakeDb();
 const event={id:'evt_paid_1',type:'invoice.paid',data:{object:{id:'in_test_1',status:'paid',currency:'usd',total:50000,amount_paid:50000,hosted_invoice_url:'https://invoice.stripe.com/i/test',invoice_pdf:'https://files.stripe.com/test.pdf',number:'INV-001',metadata:{dhf_invoice_id:'inv-1',dhf_partnership_id:'4'}}}};
 const payload=JSON.stringify(event);
 const response=await onRequestPost({request:eventRequest(payload,await signature(payload)),env:{DB,STRIPE_WEBHOOK_SECRET:'whsec_test'}});
 assert.equal(response.status,200);
 assert.ok(DB.calls.some(c=>/UPDATE sponsor_invoices SET status = 'paid'/.test(c.sql)));
 assert.ok(DB.calls.some(c=>/UPDATE sponsor_partnerships SET payment_status = 'paid'/.test(c.sql)));
});

test('invoice.payment_failed records failed payment without closing the invoice',async()=>{
 const DB=fakeDb();
 const event={id:'evt_failed_1',type:'invoice.payment_failed',data:{object:{id:'in_test_1',status:'open',currency:'usd',total:50000,hosted_invoice_url:'https://invoice.stripe.com/i/test',metadata:{dhf_invoice_id:'inv-1',dhf_partnership_id:'4'}}}};
 const payload=JSON.stringify(event);
 const response=await onRequestPost({request:eventRequest(payload,await signature(payload)),env:{DB,STRIPE_WEBHOOK_SECRET:'whsec_test'}});
 assert.equal(response.status,200);
 assert.ok(DB.calls.some(c=>/SET payment_status = 'failed'/.test(c.sql)));
});

test('invoice.voided marks an unpaid invoice void',async()=>{
 const DB=fakeDb();
 const event={id:'evt_void_1',type:'invoice.voided',data:{object:{id:'in_test_1',status:'void',currency:'usd',total:50000,metadata:{dhf_invoice_id:'inv-1',dhf_partnership_id:'4'}}}};
 const payload=JSON.stringify(event);
 const response=await onRequestPost({request:eventRequest(payload,await signature(payload)),env:{DB,STRIPE_WEBHOOK_SECRET:'whsec_test'}});
 assert.equal(response.status,200);
 assert.ok(DB.calls.some(c=>/SET status = 'void', stripe_status = 'void'/.test(c.sql)));
});

test('full charge.refunded event marks the partnership refunded',async()=>{
 const DB=fakeDb();
 const event={id:'evt_refund_1',type:'charge.refunded',data:{object:{id:'ch_test_1',invoice:'in_test_1',amount_refunded:50000}}};
 const payload=JSON.stringify(event);
 const response=await onRequestPost({request:eventRequest(payload,await signature(payload)),env:{DB,STRIPE_WEBHOOK_SECRET:'whsec_test'}});
 assert.equal(response.status,200);
 assert.ok(DB.calls.some(c=>/SET payment_status = 'refunded'/.test(c.sql)));
});

test('rejects an invalid Stripe webhook signature',async()=>{
 const DB=fakeDb();
 const payload=JSON.stringify({id:'evt_bad',type:'invoice.paid',data:{object:{id:'in_test_1'}}});
 const response=await onRequestPost({request:eventRequest(payload,'t=1,v1=bad'),env:{DB,STRIPE_WEBHOOK_SECRET:'whsec_test'}});
 assert.equal(response.status,400);
 assert.equal(DB.calls.length,0);
});

test('rejects mismatched invoice metadata and totals',async()=>{
 const DB=fakeDb();
 const event={id:'evt_mismatch',type:'invoice.paid',data:{object:{id:'in_test_1',status:'paid',currency:'usd',total:10000,metadata:{dhf_invoice_id:'inv-1',dhf_partnership_id:'4'}}}};
 const payload=JSON.stringify(event);
 const response=await onRequestPost({request:eventRequest(payload,await signature(payload)),env:{DB,STRIPE_WEBHOOK_SECRET:'whsec_test'}});
 assert.equal(response.status,400);
 assert.equal(DB.calls.some(c=>/UPDATE sponsor_partnerships/.test(c.sql)),false);
});
