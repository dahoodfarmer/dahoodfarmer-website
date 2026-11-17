import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/payments/webhook.js';

const record={invoice_id:'inv-1',partnership_id:4,amount_cents:50000};
function fakeDb({failPaidUpdateOnce=false,refundAmountCents=0}={}){
 const calls=[];
 const events=new Map();
 let shouldFailPaidUpdate=failPaidUpdateOnce;
 return {calls,prepare(sql){return{bind(...values){return{
  async first(){
   calls.push({kind:'first',sql,values});
   if(/JOIN sponsor_partnerships/.test(sql))return{invoice_id:'inv-1',partnership_id:4,description:'Corporate sponsorship',amount_cents:50000,recipient_name:'Buyer',recipient_email:'buyer@example.com',business_name:'Example Co'};
   if(/FROM payment_receipts/.test(sql))return{receipt_id:'DHF-20261117-ABCD1234',invoice_id:'inv-1',recipient_email:'buyer@example.com',amount_cents:50000,currency:'usd',paid_at:'2026-11-17T12:00:00.000Z',email_status:'not_configured'};
   return {...record,refund_amount_cents:refundAmountCents};
  },
  async run(){
   calls.push({kind:'run',sql,values});
   if(/INSERT OR IGNORE INTO payment_provider_events/.test(sql)){
    const id=values[0];if(events.has(id))return{meta:{changes:0}};events.set(id,'processing');return{meta:{changes:1}};
   }
   if(/UPDATE payment_provider_events SET status = 'processing'/.test(sql)){
    const id=values[0];if(events.get(id)==='failed'){events.set(id,'processing');return{meta:{changes:1}}}return{meta:{changes:0}};
   }
   if(/UPDATE payment_provider_events SET status = 'processed'/.test(sql)){events.set(values[0],'processed');return{meta:{changes:1}}}
   if(/UPDATE payment_provider_events SET status = 'failed'/.test(sql)){events.set(values[1],'failed');return{meta:{changes:1}}}
   if(/UPDATE sponsor_invoices SET status = 'paid'/.test(sql)&&shouldFailPaidUpdate){shouldFailPaidUpdate=false;throw new Error('temporary database failure')}
   return{meta:{changes:1}};
  }
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
const baseEnv=DB=>({DB,DHF_PAYMENTS_ENABLED:'true',DHF_PAYMENT_PROVIDER:'stripe',DHF_STRIPE_EXPECT_LIVEMODE:'false',STRIPE_WEBHOOK_SECRET:'whsec_test',DHF_RECEIPT_TOKEN_SECRET:'test-only-secret-that-is-at-least-32-chars'});
function paidEvent(id='evt_paid_1'){
 return {livemode:false,id,type:'invoice.paid',data:{object:{id:'in_test_1',status:'paid',currency:'usd',total:50000,amount_paid:50000,hosted_invoice_url:'https://invoice.stripe.com/i/test',invoice_pdf:'https://files.stripe.com/test.pdf',number:'INV-001',metadata:{dhf_invoice_id:'inv-1',dhf_partnership_id:'4'}}}};
}

test('verified invoice.paid webhook marks invoice and partnership paid and creates receipt',async()=>{
 const DB=fakeDb(),event=paidEvent(),payload=JSON.stringify(event);
 const response=await onRequestPost({request:eventRequest(payload,await signature(payload)),env:baseEnv(DB)});
 assert.equal(response.status,200);
 assert.ok(DB.calls.some(c=>/UPDATE sponsor_invoices SET status = 'paid'/.test(c.sql)));
 assert.ok(DB.calls.some(c=>/UPDATE sponsor_partnerships SET payment_status = 'paid'/.test(c.sql)));
 assert.ok(DB.calls.some(c=>/INSERT OR IGNORE INTO payment_provider_events/.test(c.sql)));
 assert.ok(DB.calls.some(c=>/INSERT OR IGNORE INTO payment_receipts/.test(c.sql)));
 assert.ok(DB.calls.some(c=>/SET status = 'processed'/.test(c.sql)));
});

test('paid webhook remains retryable until receipt-token security is configured',async()=>{
 const DB=fakeDb(),event=paidEvent('evt_paid_no_receipt_secret'),payload=JSON.stringify(event);
 const response=await onRequestPost({request:eventRequest(payload,await signature(payload)),env:{DB,DHF_PAYMENTS_ENABLED:'true',DHF_PAYMENT_PROVIDER:'stripe',STRIPE_WEBHOOK_SECRET:'whsec_test'}});
 assert.equal(response.status,503);
 assert.equal(DB.calls.length,0);
});

test('rejects live-mode Stripe events in a test-mode Preview environment',async()=>{
 const DB=fakeDb(),event=paidEvent('evt_live_in_preview');event.livemode=true;
 const payload=JSON.stringify(event);
 const response=await onRequestPost({request:eventRequest(payload,await signature(payload)),env:baseEnv(DB)});
 assert.equal(response.status,400);
 assert.equal(DB.calls.length,0);
});

test('invoice.payment_failed records failed payment without closing the invoice',async()=>{
 const DB=fakeDb(),event={livemode:false,id:'evt_failed_1',type:'invoice.payment_failed',data:{object:{id:'in_test_1',status:'open',currency:'usd',total:50000,hosted_invoice_url:'https://invoice.stripe.com/i/test',metadata:{dhf_invoice_id:'inv-1',dhf_partnership_id:'4'}}}};
 const payload=JSON.stringify(event);
 const response=await onRequestPost({request:eventRequest(payload,await signature(payload)),env:baseEnv(DB)});
 assert.equal(response.status,200);
 assert.ok(DB.calls.some(c=>/SET payment_status = 'failed'/.test(c.sql)));
});

test('invoice.voided marks an unpaid invoice void',async()=>{
 const DB=fakeDb(),event={livemode:false,id:'evt_void_1',type:'invoice.voided',data:{object:{id:'in_test_1',status:'void',currency:'usd',total:50000,metadata:{dhf_invoice_id:'inv-1',dhf_partnership_id:'4'}}}};
 const payload=JSON.stringify(event);
 const response=await onRequestPost({request:eventRequest(payload,await signature(payload)),env:baseEnv(DB)});
 assert.equal(response.status,200);
 assert.ok(DB.calls.some(c=>/SET status = 'void', stripe_status = 'void'/.test(c.sql)));
});

test('full charge.refunded event marks the partnership refunded',async()=>{
 const DB=fakeDb(),event={livemode:false,id:'evt_refund_1',type:'charge.refunded',data:{object:{id:'ch_test_1',invoice:'in_test_1',amount_refunded:50000}}};
 const payload=JSON.stringify(event);
 const response=await onRequestPost({request:eventRequest(payload,await signature(payload)),env:baseEnv(DB)});
 assert.equal(response.status,200);
 assert.ok(DB.calls.some(c=>/SET payment_status = 'refunded'/.test(c.sql)));
});

test('rejects an invalid Stripe webhook signature',async()=>{
 const DB=fakeDb(),payload=JSON.stringify({livemode:false,id:'evt_bad',type:'invoice.paid',data:{object:{id:'in_test_1'}}});
 const response=await onRequestPost({request:eventRequest(payload,'t=1,v1=bad'),env:baseEnv(DB)});
 assert.equal(response.status,400);
 assert.equal(DB.calls.length,0);
});

test('rejects mismatched invoice metadata and totals before claiming the event',async()=>{
 const DB=fakeDb(),event=paidEvent('evt_mismatch');event.data.object.total=10000;
 const payload=JSON.stringify(event);
 const response=await onRequestPost({request:eventRequest(payload,await signature(payload)),env:baseEnv(DB)});
 assert.equal(response.status,400);
 assert.equal(DB.calls.some(c=>/INSERT OR IGNORE INTO payment_provider_events/.test(c.sql)),false);
 assert.equal(DB.calls.some(c=>/UPDATE sponsor_partnerships/.test(c.sql)),false);
});

test('webhook endpoint rejects events while provider payments are disabled',async()=>{
 const DB=fakeDb(),payload=JSON.stringify({livemode:false,id:'evt_disabled',type:'invoice.paid',data:{object:{id:'in_test_1'}}});
 const response=await onRequestPost({request:eventRequest(payload,'t=1,v1=bad'),env:{DB,STRIPE_WEBHOOK_SECRET:'whsec_test'}});
 assert.equal(response.status,503);
 assert.equal(DB.calls.length,0);
});

test('duplicate Stripe event is acknowledged without repeating invoice or receipt processing',async()=>{
 const DB=fakeDb(),event=paidEvent('evt_paid_duplicate'),payload=JSON.stringify(event),sig=await signature(payload),env=baseEnv(DB);
 const first=await onRequestPost({request:eventRequest(payload,sig),env});
 const second=await onRequestPost({request:eventRequest(payload,sig),env});
 assert.equal(first.status,200);
 assert.equal(second.status,200);
 assert.equal((await second.json()).duplicate,true);
 assert.equal(DB.calls.filter(c=>/UPDATE sponsor_invoices SET status = 'paid'/.test(c.sql)).length,1);
 assert.equal(DB.calls.filter(c=>/INSERT OR IGNORE INTO payment_receipts/.test(c.sql)).length,1);
});

test('failed webhook processing is marked failed and can be safely retried',async()=>{
 const DB=fakeDb({failPaidUpdateOnce:true}),event=paidEvent('evt_paid_retry'),payload=JSON.stringify(event),sig=await signature(payload),env=baseEnv(DB);
 const first=await onRequestPost({request:eventRequest(payload,sig),env});
 const second=await onRequestPost({request:eventRequest(payload,sig),env});
 assert.equal(first.status,500);
 assert.equal(second.status,200);
 assert.equal(DB.calls.filter(c=>/UPDATE sponsor_invoices SET status = 'paid'/.test(c.sql)).length,2);
 assert.ok(DB.calls.some(c=>/SET status = 'failed'/.test(c.sql)));
 assert.ok(DB.calls.some(c=>/SET status = 'processed'/.test(c.sql)));
});


test('late invoice.paid event cannot overwrite an already-recorded full refund',async()=>{
 const DB=fakeDb({refundAmountCents:50000}),event=paidEvent('evt_paid_after_refund'),payload=JSON.stringify(event);
 const response=await onRequestPost({request:eventRequest(payload,await signature(payload)),env:baseEnv(DB)});
 assert.equal(response.status,200);
 const invoiceUpdate=DB.calls.find(c=>/UPDATE sponsor_invoices SET status = 'paid'/.test(c.sql));
 const partnershipUpdate=DB.calls.find(c=>/UPDATE sponsor_partnerships SET payment_status = CASE WHEN EXISTS/.test(c.sql));
 assert.ok(invoiceUpdate);
 assert.ok(invoiceUpdate.sql.includes("WHEN refund_amount_cents > 0 THEN 'partially_refunded'"));
 assert.ok(partnershipUpdate);
 assert.match(partnershipUpdate.sql,/refund_amount_cents >= amount_cents/);
 assert.equal(partnershipUpdate.values[0],'inv-1');
});

test('late invoice.finalized event cannot downgrade a paid or refunded invoice',async()=>{
 const DB=fakeDb(),event={livemode:false,id:'evt_finalized_late',type:'invoice.finalized',data:{object:{id:'in_test_1',status:'open',currency:'usd',total:50000,metadata:{dhf_invoice_id:'inv-1',dhf_partnership_id:'4'}}}};
 const payload=JSON.stringify(event);
 const response=await onRequestPost({request:eventRequest(payload,await signature(payload)),env:baseEnv(DB)});
 assert.equal(response.status,200);
 const update=DB.calls.find(c=>/UPDATE sponsor_invoices SET status = CASE/.test(c.sql));
 assert.ok(update);
 assert.ok(update.sql.includes("status IN ('paid','refunded','void')"));
});


test('late invoice.finalized event preserves a previously recorded partial refund',async()=>{
 const DB=fakeDb({refundAmountCents:12000}),event={livemode:false,id:'evt_finalized_after_partial_refund',type:'invoice.finalized',data:{object:{id:'in_test_1',status:'open',currency:'usd',total:50000,metadata:{dhf_invoice_id:'inv-1',dhf_partnership_id:'4'}}}};
 const payload=JSON.stringify(event);
 const response=await onRequestPost({request:eventRequest(payload,await signature(payload)),env:baseEnv(DB)});
 assert.equal(response.status,200);
 const update=DB.calls.find(c=>/UPDATE sponsor_invoices SET status = CASE/.test(c.sql));
 assert.ok(update.sql.includes("WHEN refund_amount_cents > 0 THEN 'paid'"));
 assert.ok(update.sql.includes("WHEN refund_amount_cents > 0 THEN 'partially_refunded'"));
});

test('late invoice.voided event cannot erase a recorded refund',async()=>{
 const DB=fakeDb({refundAmountCents:12000}),event={livemode:false,id:'evt_void_after_refund',type:'invoice.voided',data:{object:{id:'in_test_1',status:'void',currency:'usd',total:50000,metadata:{dhf_invoice_id:'inv-1',dhf_partnership_id:'4'}}}};
 const payload=JSON.stringify(event);
 const response=await onRequestPost({request:eventRequest(payload,await signature(payload)),env:baseEnv(DB)});
 assert.equal(response.status,200);
 const update=DB.calls.find(c=>/UPDATE sponsor_invoices SET status = 'void'/.test(c.sql));
 assert.ok(update.sql.includes('refund_amount_cents = 0'));
});
