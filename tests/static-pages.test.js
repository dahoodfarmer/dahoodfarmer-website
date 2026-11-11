import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');

test('all DHF Opportunity Network landing pages exist with canonical URLs and descriptions',()=>{
  const pages=['public/business.html','public/summits.html','public/marketplace.html','public/academy.html','public/experiences.html','public/sponsors.html','public/business-directory.html'];
  for(const file of pages){
    const html=read(file);
    assert.match(html,/<link rel="canonical" href="https:\/\/dahoodfarmer\.com\//,file+' canonical');
    assert.match(html,/<meta name="description" content="[^"]+"/,file+' description');
  }
});

test('every opportunity application form includes an application type and required contact consent',()=>{
  const pages=['public/business.html','public/summits.html','public/marketplace.html','public/academy.html','public/experiences.html','public/sponsors.html'];
  let count=0;
  for(const file of pages){
    const html=read(file);
    const forms=[...html.matchAll(/<form\b[\s\S]*?<\/form>/gi)].map(m=>m[0]).filter(form=>form.includes('data-opportunity-form'));
    for(const form of forms){
      count++;
      assert.match(form,/<input type="hidden" name="application_type" value="[^"]+"/,file+' application type');
      assert.match(form,/<input type="checkbox" name="contact_consent" required>/,file+' required contact consent');
      assert.match(form,/<div class="cf-turnstile"><\/div>/,file+' Turnstile container');
    }
  }
  assert.ok(count>=7,'expected business, speaker, attendee, vendor, academy, property and sponsor applications');
});

test('admin dashboard inline JavaScript parses and exposes separate review fields',()=>{
  const html=read('public/admin/index.html');
  const scripts=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)];
  const inline=scripts.filter(m=>!/\bsrc\s*=/.test(m[1])&&!/application\/ld\+json/i.test(m[1])).map(m=>m[2]).filter(Boolean);
  assert.ok(inline.length>0,'expected an inline admin script');
  for(const source of inline) assert.doesNotThrow(()=>new Function(source));
  assert.match(html,/<th>Interest \/ package<\/th>/);
  assert.match(html,/<th>Proposed public profile<\/th>/);
  assert.match(html,/a\.public_description/);
  assert.match(html,/colspan="12"/);
  const rowTemplate=html.match(/return '<tr data-app-id=[^\\n]+/);
  assert.ok(rowTemplate,'application row template exists');
  assert.equal((rowTemplate[0].match(/<td>/g)||[]).length,12,'application row must match all 12 table columns');
});

test('directory renderer builds nodes without assigning untrusted data to innerHTML',()=>{
  const js=read('public/business-directory.js');
  assert.match(js,/createElement/);
  assert.match(js,/textContent/);
  assert.match(js,/replaceChildren/);
  assert.doesNotMatch(js,/\.innerHTML\s*=/);
});

test('shared form handler routes Opportunity Network forms to the server intake endpoint',()=>{
  const js=read('public/forms.js');
  assert.match(js,/form\[data-opportunity-form\]/);
  assert.match(js,/\/api\/opportunity-application/);
});

test('sitemap includes the five funnels, sponsor page and directory',()=>{
  const xml=read('public/sitemap.xml');
  for(const route of ['business','summits','marketplace','academy','experiences','sponsors','business-directory']){
    assert.match(xml,new RegExp('https://dahoodfarmer\\.com/'+route));
  }
});

test('privacy and terms disclose applications, separate consent and international availability',()=>{
  const privacy=read('public/privacy-policy.html');
  const terms=read('public/terms.html');
  assert.match(privacy,/Cloudflare Web Analytics/);
  assert.match(privacy,/public business-directory profile/);
  assert.match(privacy,/International Inquiries/);
  assert.match(terms,/all 50 U\.S\. states and internationally/);
  assert.match(terms,/does not automatically publish a business profile/);
});
