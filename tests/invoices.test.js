import test from 'node:test';
import assert from 'node:assert/strict';
import { hashInvoiceToken, findInvoiceByToken } from '../functions/lib/invoices.js';
import { onRequestGet as getInvoice } from '../functions/api/payments/invoice.js';
import { onRequestPost as createSession } from '../functions/api/payments/create-session.js';
import { onRequestPost as receiveWebhook } from '../functions/api/payments/webhook.js';

const token='a'.repeat(64);
const invoice={invoice_id:'inv-1',partnership_id:4,amount_cents:50000,currency:'usd',description:'DHF Corporate Partner sponsorship',due_date:null,status:'issued',package_name:'Corporate Partner',contract_status:'signed',organization:'Example Sponsor',contact_email:'buyer@example.com'};

function fakeDb(kind, options={}) {
  const calls=[];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() {
              calls.push({kind:'first',sql,values});
              if(kind==='main' && /FROM sponsor_invoices/.test(sql)) return options.invoice===undefined?invoice:options.invoice;
              if(kind==='payments' && /FROM dhf_payment_orders/.test(sql)) return options.order || null;
              return options.first || null;
            },
            async run() {
              calls.push({kind:'run',sql,values});
              if(options.failRun) throw new Error('D1 write failed');
              return {meta:{changes:1,last_row_id:1}};
            },
            async all() { calls.push({kind:'all',sql,values}); return {results:[]}; }
          };
        }
      };
    }
  };
}
function kv(){return {async get(){return null},async put(){}}}
function request(url,body,origin){return new Request(url,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin||new URL(url).origin,'CF-Connecting-IP':'198.51.100.10'},body:JSON.stringify(body)})}
async function withFetch(mock,fn){const old=globalThis.fetch;globalThis.fetch=mock;try{return await fn()}finally{globalThis.fetch=old}}
async function stripeSignature(payload,secret='whsec_test'){
 const timestamp=Math.floor(Date.now()/1000),encoder=new TextEncoder();
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const digest=await crypto.subtle.sign('HMAC',key,encoder.encode(timestamp+'.'+payload));
 const hex=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
 return 't='+timestamp+',v1='+hex;
}

test('invoice token is stored as a one-way SHA-256 hash',async()=>{
 const hash=await hashInvoiceToken(token);
 assert.match(hash,/^[a-f0-9]{64}$/);
 assert.notEqual(hash,token);
 const DB=fakeDb('main');
 await findInvoiceByToken(DB,token);
 assert.equal(DB.calls[0].values[0],hash);
});

test('public invoice endpoint rejects malformed tokens',async()=>{
 const DB=fakeDb('main');
 const response=await getInvoice({request:new Request('https://dahoodfarmer.com/api/payments/invoice?token=bad'),env:{DB}});
 assert.equal(response.status,400);
 assert.equal(DB.calls.length,0);
});

test('public invoice endpoint exposes only payment-relevant fields',async()=>{
 const DB=fakeDb('main');
 const response=await getInvoice({request:new Request('https://dahoodfarmer.com/api/payments/invoice?token='+token),env:{DB,DHF_CHECKOUT_ENABLED:'false'}});
 const body=await response.json();
 assert.equal(response.status,200);
 assert.equal(body.invoice.amount_cents,50000);
 assert.equal(body.invoice.organization,'Example Sponsor');
 assert.equal(body.checkout_available,false);
 assert.equal('contact_email' in body.invoice,false);
 assert.equal('notes' in body.invoice,false);
});

test('public invoice endpoint rejects paid, void and expired invoices',async()=>{
 for(const status of ['void','expired']){
  const DB=fakeDb('main',{invoice:{...invoice,status}});
  const response=await getInvoice({request:new Request('https://dahoodfarmer.com/api/payments/invoice?token='+token),env:{DB}});
  assert.equal(response.status,410);
 }
 const DB=fakeDb('main',{invoice:{...invoice,status:'paid'}});
 const response=await getInvoice({request:new Request('https://dahoodfarmer.com/api/payments/invoice?token='+token),env:{DB}});
 const body=await response.json();
 assert.equal(response.status,200);
 assert.equal(body.invoice.status,'paid');
});

test('invoice checkout fails closed while the owner payment gate is disabled',async()=>{
 const response=await createSession({request:request('https://dahoodfarmer.com/api/payments/create-session',{purpose:'invoice',invoice_token:token}),env:{DHF_CHECKOUT_ENABLED:'false'}});
 assert.equal(response.status,503);
});

test('invoice checkout uses the stored server-side amount, not a browser-supplied amount',async()=>{
 const DB=fakeDb('main');
 const PAYMENTS_DB=fakeDb('payments');
 const env={DHF_CHECKOUT_ENABLED:'true',STRIPE_SECRET_KEY:'sk_test_mock',STRIPE_PUBLISHABLE_KEY:'pk_test_mock',PAYMENTS_DB,DB,SESSIONS:kv()};
 let params;
 const response=await withFetch(async(url,init)=>{
  assert.equal(url,'https://api.stripe.com/v1/checkout/sessions');
  params=new URLSearchParams(init.body);
  return new Response(JSON.stringify({id:'cs_test_invoice123',client_secret:'cs_test_invoice123_secret'}),{status:200});
 },()=>createSession({request:request('https://dahoodfarmer.com/api/payments/create-session',{purpose:'invoice',invoice_token:token,amount:100}),env}));
 const body=await response.json();
 assert.equal(response.status,200);
 assert.equal(params.get('line_items[0][price_data][unit_amount]'),'50000');
 assert.equal(params.get('metadata[invoice_id]'),'inv-1');
 assert.equal(params.get('metadata[partnership_id]'),'4');
 assert.equal(body.clientSecret,'cs_test_invoice123_secret');
 assert.ok(PAYMENTS_DB.calls.some(c=>/INSERT INTO dhf_payment_orders/.test(c.sql)&&c.values.includes('inv-1')));
 assert.ok(DB.calls.some(c=>/UPDATE sponsor_invoices SET status = 'pending'/.test(c.sql)));
});

test('invoice checkout rejects a token that does not resolve to an invoice',async()=>{
 const DB=fakeDb('main',{invoice:null});
 const PAYMENTS_DB=fakeDb('payments');
 const env={DHF_CHECKOUT_ENABLED:'true',STRIPE_SECRET_KEY:'sk_test_mock',STRIPE_PUBLISHABLE_KEY:'pk_test_mock',PAYMENTS_DB,DB,SESSIONS:kv()};
 const response=await createSession({request:request('https://dahoodfarmer.com/api/payments/create-session',{purpose:'invoice',invoice_token:token}),env});
 assert.equal(response.status,404);
 assert.equal(PAYMENTS_DB.calls.length,0);
});

test('invoice checkout rejects browser-supplied purpose and invalid cross-origin requests',async()=>{
 const DB=fakeDb('main'),PAYMENTS_DB=fakeDb('payments');
 const env={DHF_CHECKOUT_ENABLED:'true',STRIPE_SECRET_KEY:'sk_test_mock',STRIPE_PUBLISHABLE_KEY:'pk_test_mock',PAYMENTS_DB,DB,SESSIONS:kv()};
 const bad=await createSession({request:request('https://dahoodfarmer.com/api/payments/create-session',{purpose:'product',invoice_token:token}),env});
 const cross=await createSession({request:request('https://dahoodfarmer.com/api/payments/create-session',{purpose:'invoice',invoice_token:token},'https://attacker.example'),env});
 assert.equal(bad.status,422);
 assert.equal(cross.status,403);
});

test('verified Stripe invoice webhook marks the invoice and partnership paid',async()=>{
 const PAYMENTS_DB=fakeDb('payments',{order:{order_id:'order-1',amount:50000,currency:'usd',purpose:'invoice',invoice_id:'inv-1',partnership_id:4}});
 const DB=fakeDb('main');
 const event={id:'evt_invoice_1',type:'checkout.session.completed',data:{object:{id:'cs_test_invoice123',payment_status:'paid',metadata:{order_id:'order-1',invoice_id:'inv-1',partnership_id:'4'},amount_total:50000,currency:'usd',customer_details:{email:'buyer@example.com'}}}};
 const payload=JSON.stringify(event);
 const response=await receiveWebhook({request:new Request('https://dahoodfarmer.com/api/payments/webhook',{method:'POST',headers:{'Stripe-Signature':await stripeSignature(payload)},body:payload}),env:{STRIPE_WEBHOOK_SECRET:'whsec_test',PAYMENTS_DB,DB}});
 assert.equal(response.status,200);
 assert.ok(PAYMENTS_DB.calls.some(c=>/UPDATE dhf_payment_orders SET status = \?/.test(c.sql)&&c.values[0]==='paid'));
 assert.ok(DB.calls.some(c=>/UPDATE sponsor_invoices SET status = 'paid'/.test(c.sql)));
 assert.ok(DB.calls.some(c=>/UPDATE sponsor_partnerships SET payment_status = 'paid'/.test(c.sql)));
});

test('invoice webhook rejects mismatched metadata before marking paid',async()=>{
 const PAYMENTS_DB=fakeDb('payments',{order:{order_id:'order-1',amount:50000,currency:'usd',purpose:'invoice',invoice_id:'inv-1',partnership_id:4}});
 const DB=fakeDb('main');
 const event={id:'evt_invoice_2',type:'checkout.session.completed',data:{object:{id:'cs_test_invoice123',payment_status:'paid',metadata:{order_id:'order-1',invoice_id:'wrong',partnership_id:'4'},amount_total:50000,currency:'usd'}}};
 const payload=JSON.stringify(event);
 const response=await receiveWebhook({request:new Request('https://dahoodfarmer.com/api/payments/webhook',{method:'POST',headers:{'Stripe-Signature':await stripeSignature(payload)},body:payload}),env:{STRIPE_WEBHOOK_SECRET:'whsec_test',PAYMENTS_DB,DB}});
 assert.equal(response.status,400);
 assert.equal(DB.calls.length,0);
});
