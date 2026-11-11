import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet as publicCatalog } from '../functions/api/opportunity-products.js';
import { onRequestGet as adminCatalog, onRequestPost as updateProduct } from '../functions/api/admin/opportunity-products.js';

function makeDb(options={}) {
  const calls=[];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async all() { calls.push({kind:'all',sql,values}); return {results:options.products||[]}; },
            async first() { calls.push({kind:'first',sql,values}); return options.product||{product_id:'summit-general-admission'}; },
            async run() { calls.push({kind:'run',sql,values}); return {meta:{changes:1}}; }
          };
        },
        async all() { calls.push({kind:'all',sql,values:[]}); return {results:options.products||[]}; }
      };
    }
  };
}
const origin='https://feature-dhf-opportunity-netw-7nbf.dahoodfarmer-website.pages.dev';
function request(path,body,originHeader=origin) {
  return new Request(origin+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:originHeader},body:JSON.stringify(body)});
}

test('public product catalog returns only the safe public projection',async()=>{
  const db=makeDb({products:[{product_id:'summit-general-admission',slug:'summit-general-admission',funnel:'summits',product_type:'event_ticket',name:'General Admission',description:'Event ticket',price_cents:2000,currency:'usd',max_quantity:10,inventory_limit:null,inventory_sold:0}]});
  const response=await publicCatalog({request:new Request(origin+'/api/opportunity-products?funnel=summits'),env:{DB:db}});
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.total,1);
  assert.equal(body.products[0].price_cents,2000);
  assert.doesNotMatch(db.calls[0].sql,/email|application_id|customer/);
  assert.match(db.calls[0].sql,/status = 'active'/);
});

test('public product catalog rejects unsupported funnel filters',async()=>{
  const db=makeDb();
  const response=await publicCatalog({request:new Request(origin+'/api/opportunity-products?funnel=unknown'),env:{DB:db}});
  assert.equal(response.status,400);
  assert.equal(db.calls.length,0);
});

test('Land & Experiences is a supported catalog filter without inventing an offer',async()=>{
  const db=makeDb();
  const response=await publicCatalog({request:new Request(origin+'/api/opportunity-products?funnel=experiences'),env:{DB:db}});
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.total,0);
  assert.match(db.calls[0].sql,/funnel = \\?/);
  assert.deepEqual(db.calls[0].values,['experiences']);
});

test('admin product list reports checkout disabled until all test bindings and gate are present',async()=>{
  const db=makeDb();
  const response=await adminCatalog({env:{DB:db,PAYMENTS_DB:{},STRIPE_SECRET_KEY:'sk_test'}});
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.checkout_enabled,false);
  assert.equal(db.calls.length,1);
});

test('admin product update refuses activation while checkout is disabled',async()=>{
  const db=makeDb();
  const response=await updateProduct({request:request('/api/admin/opportunity-products',{product_id:'summit-general-admission',status:'active',price_cents:2000}),env:{DB:db}});
  assert.equal(response.status,409);
  assert.equal(db.calls.length,0);
});

test('admin product update rejects invalid prices before database writes',async()=>{
  const db=makeDb();
  const response=await updateProduct({request:request('/api/admin/opportunity-products',{product_id:'summit-general-admission',status:'draft',price_cents:0}),env:{DB:db}});
  assert.equal(response.status,422);
  assert.equal(db.calls.length,0);
});

test('admin product update rejects cross-origin writes',async()=>{
  const db=makeDb();
  const response=await updateProduct({request:request('/api/admin/opportunity-products',{product_id:'summit-general-admission',status:'draft',price_cents:2000},'https://attacker.example'),env:{DB:db}});
  assert.equal(response.status,403);
  assert.equal(db.calls.length,0);
});

test('admin product update saves an approved draft price without activating checkout',async()=>{
  const db=makeDb();
  const response=await updateProduct({request:request('/api/admin/opportunity-products',{product_id:'summit-general-admission',status:'draft',price_cents:2500,requires_approval:false,required_application_type:''}),env:{DB:db}});
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.status,'draft');
  assert.equal(body.price_cents,2500);
  assert.equal(body.checkout_enabled,false);
  assert.ok(db.calls.some(c=>c.kind==='run'&&/UPDATE opportunity_products/.test(c.sql)));
});
