import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet, onRequestPost } from '../functions/api/admin/sponsor-prospects.js';

function fakeDb(options={}) {
 const calls=[];
 return {calls,prepare(sql){return{bind(...values){return{
  async first(){calls.push({kind:'first',sql,values});return options.prospect||null},
  async all(){calls.push({kind:'all',sql,values});return{results:options.results||[]}},
  async run(){calls.push({kind:'run',sql,values});return{meta:{changes:1,last_row_id:5}}}
 }}}}};
}
function req(body,origin='https://preview.example'){
 return new Request('https://preview.example/api/admin/sponsor-prospects',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
}

test('prospect GET returns records and recent activity',async()=>{
 const DB=fakeDb({results:[{id:1,organization:'Example Co'}]});
 const response=await onRequestGet({env:{DB}});
 const body=await response.json();
 assert.equal(response.status,200);
 assert.ok(Array.isArray(body.prospects));
 assert.ok(Array.isArray(body.activities));
 assert.equal(DB.calls.length,2);
});

test('adds a prospect to the research queue without approving outreach',async()=>{
 const DB=fakeDb();
 const response=await onRequestPost({request:req({action:'add',organization:'Example Co',partner_type:'corporate_sponsor',division:'business_network',fit_score:8,website:'https://example.com',source_url:'https://example.com/sponsorship',public_email:'partner@example.com'}),env:{DB}});
 const body=await response.json();
 assert.equal(response.status,201);
 assert.equal(body.id,5);
 assert.ok(DB.calls.some(c=>/INSERT INTO sponsor_prospects/.test(c.sql)));
 assert.equal(DB.calls.some(c=>/owner_approved_at/.test(c.sql)),false);
});

test('rejects non-HTTPS source and invalid public email',async()=>{
 const DB=fakeDb();
 const insecure=await onRequestPost({request:req({action:'add',organization:'Example Co',partner_type:'corporate_sponsor',division:'business_network',website:'http://example.com'}),env:{DB}});
 const badEmail=await onRequestPost({request:req({action:'add',organization:'Example Co',partner_type:'corporate_sponsor',division:'business_network',public_email:'not-an-email'}),env:{DB}});
 assert.equal(insecure.status,422);
 assert.equal(badEmail.status,422);
});

test('requires owner approval before moving to contacted or proposal',async()=>{
 const DB=fakeDb({prospect:{id:5,stage:'qualified',owner_approved_at:null}});
 const response=await onRequestPost({request:req({action:'update',id:5,organization:'Example Co',partner_type:'corporate_sponsor',division:'business_network',stage:'contacted',fit_score:8}),env:{DB}});
 assert.equal(response.status,409);
});

test('outreach approval is only available after qualification or route verification',async()=>{
 const DB=fakeDb({prospect:{id:5,stage:'research',owner_approved_at:null}});
 const response=await onRequestPost({request:req({action:'approve_outreach',id:5}),env:{DB}});
 assert.equal(response.status,409);
 assert.equal(DB.calls.some(c=>/owner_approved_at = datetime/.test(c.sql)),false);
});

test('owner approval can be recorded after qualification',async()=>{
 const DB=fakeDb({prospect:{id:5,stage:'contact_route_verified',owner_approved_at:null}});
 const response=await onRequestPost({request:req({action:'approve_outreach',id:5}),env:{DB}});
 const body=await response.json();
 assert.equal(response.status,200);
 assert.equal(body.stage,'owner_approved');
 assert.ok(DB.calls.some(c=>/owner_approved_at = datetime/.test(c.sql)));
});

test('does not log outreach until owner approval exists',async()=>{
 const DB=fakeDb({prospect:{id:5,owner_approved_at:null}});
 const response=await onRequestPost({request:req({action:'log_activity',id:5,activity_type:'outreach',summary:'Sent approved introduction.'}),env:{DB}});
 assert.equal(response.status,409);
});

test('logs manually completed outreach only after owner approval',async()=>{
 const DB=fakeDb({prospect:{id:5,owner_approved_at:'2026-11-17 12:00:00'}});
 const response=await onRequestPost({request:req({action:'log_activity',id:5,activity_type:'outreach',summary:'Sent approved introduction.'}),env:{DB}});
 assert.equal(response.status,200);
 assert.ok(DB.calls.some(c=>/INSERT INTO sponsor_prospect_activities/.test(c.sql)));
 assert.ok(DB.calls.some(c=>/last_contacted_at = datetime/.test(c.sql)));
});

test('rejects cross-origin prospect CRM writes',async()=>{
 const DB=fakeDb();
 const response=await onRequestPost({request:req({action:'add',organization:'Example Co',partner_type:'corporate_sponsor',division:'business_network'},'https://attacker.example'),env:{DB}});
 assert.equal(response.status,403);
 assert.equal(DB.calls.length,0);
});
