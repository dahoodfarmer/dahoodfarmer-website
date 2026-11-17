import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/payments/webhook.js';

const record={invoice_id:'inv-1',partnership_id:4,amount_cents:50000};
function fakeDb({failPaidUpdateOnce=false}={}){
 const calls=[];
 const events=new Map();
 let shouldFailPaidUpdate=failPaidUpdateOnce;
 return {calls,prepare(sql){return{bind(...values){return{
  async first(){calls.push({kind:'first',sql,values});if(/JOIN sponsor_partnerships/.test(sql))return{invoice_id:'inv-1',partnership_id:4,description:'Corporate sponsorship',amount_cents:50000,recipient_name:'Buyer',recipient_email:'buyer@example.com',business_name:'Example Co'};if(/FROM payment_receipts/.test(sql))return{receipt_id:'DHF-20261117-ABCD1234',invoice_id:'inv-1',recipient_email:'buyer@example.com',amount_cents:50000,currency:'usd',paid_at:'2026-11-17T12:00:00.000Z',email_status:'not_configured'};return record},
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


test('failed webhook processing is marked failed and can be safely retried',async()=>{
 const DB=fakeDb({failPaidUpdateOnce:true});
 const event={livemode:false,id:'evt_paid_retry',type:'invoice.paid',data:{object:{id:'in_test_1',status:'paid',currency:'usd',total:50000,amount_paid:50000,metadata:{dhf_invoice_id:'inv-1',dhf_partnership_id:'4'}}}};
 const payload=JSON.stringify(event),sig=await signature(payload);
 const env={DB,DHF_PAYMENTS_ENABLED:'true',DHF_PAYMENT_PROVIDER:'stripe',STRIPE_WEBHOOK_SECRET:'whsec_test',DHF_RECEIPT_TOKEN_SECRET:'test-only-secret-that-is-at-least-32-chars'};
 const first=await onRequestPost({request:eventRequest(payload,sig),env});
 const second=await onRequestPost({request:eventRequest(payload,sig),env});
 assert.equal(first.status,500);
 assert.equal(second.status,200);
 assert.equal(DB.calls.filter(c=>/UPDATE sponsor_invoices SET status = 'paid'/.test(c.sql)).length,2);
 assert.ok(DB.calls.some(c=>/SET status = 'failed'/.test(c.sql)));
 assert.ok(DB.calls.some(c=>/SET status = 'processed'/.test(c.sql)));
});
