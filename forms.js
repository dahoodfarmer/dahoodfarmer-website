(function() {
  'use strict';
  var TURNSTILE_SITE_KEY = window.TURNSTILE_SITE_KEY || '';
  function showMessage(form, message, isSuccess) {
    var existing = form.querySelector('.form-message');
    if (existing) existing.remove();
    var div = document.createElement('div');
    div.className = 'form-message';
    div.style.cssText = 'padding:12px 16px;margin:12px 0;border-radius:8px;font-size:14px;' +
      (isSuccess ? 'background:#d4edda;color:#155724;border:1px solid #c3e6cb;' : 'background:#f8d7da;color:#721c24;border:1px solid #f5c6cb;');
    div.textContent = message;
    form.appendChild(div);
    if (isSuccess) setTimeout(function() { div.remove(); }, 5000);
  }
  function getTurnstileToken(form) {
    var input = form.querySelector('[name="cf-turnstile-response"]');
    if (input && input.value) return input.value;
    return '';
  }
  function addTurnstile(form) {
    if (form.querySelector('.cf-turnstile')) return;
    if (!TURNSTILE_SITE_KEY) return;
    var div = document.createElement('div');
    div.className = 'cf-turnstile';
    div.setAttribute('data-sitekey', TURNSTILE_SITE_KEY);
    div.style.marginTop = '12px';
    var submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
    if (submitBtn) submitBtn.parentNode.insertBefore(div, submitBtn);
    else form.appendChild(div);
  }
  function serializeForm(form) {
    var data = {};
    var inputs = form.querySelectorAll('input, textarea, select');
    for (var i = 0; i < inputs.length; i++) {
      if (inputs[i].name && inputs[i].name !== 'cf-turnstile-response') data[inputs[i].name] = inputs[i].value;
    }
    data['cf-turnstile-response'] = getTurnstileToken(form);
    return data;
  }
  function wireForm(form, endpoint) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var data = serializeForm(form);
      var submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
      var orig = submitBtn ? (submitBtn.textContent || submitBtn.value) : '';
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending...'; if (submitBtn.value) submitBtn.value = 'Sending...'; }
      fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function(r) { return r.json(); })
      .then(function(result) {
        if (result.success) { showMessage(form, result.message || 'Success!', true); form.reset(); }
        else { showMessage(form, result.error || 'Something went wrong.', false); }
      })
      .catch(function() { showMessage(form, 'Network error. Please try again.', false); })
      .finally(function() { if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = orig; if (submitBtn.value) submitBtn.value = orig; } });
    });
  }
  function detectFormType(form) {
    var inputs = form.querySelectorAll('input, textarea, select');
    var fields = [];
    for (var i = 0; i < inputs.length; i++) { if (inputs[i].name) fields.push(inputs[i].name.toLowerCase()); }
    var hasMessage = fields.indexOf('message') !== -1 || form.querySelector('textarea') !== null;
    var hasInquiry = fields.indexOf('inquiry_type') !== -1 || fields.indexOf('inquiry') !== -1;
    var hasOnlyEmail = fields.length === 1 && fields[0] === 'email';
    var path = window.location.pathname.toLowerCase();
    if (hasOnlyEmail || (fields.indexOf('email') !== -1 && !hasMessage && !hasInquiry && path === '/')) return '/api/newsletter';
    if (hasInquiry || path.indexOf('booking') !== -1) return '/api/booking';
    if (hasMessage || path.indexOf('contact') !== -1) return '/api/contact';
    if (fields.indexOf('email') !== -1 && hasMessage) return '/api/contact';
    if (fields.indexOf('email') !== -1) return '/api/newsletter';
    return null;
  }
  function init() {
    var forms = document.querySelectorAll('form');
    if (!forms.length) return;
    for (var i = 0; i < forms.length; i++) {
      if (forms[i].getAttribute('role') === 'search') continue;
      var ep = detectFormType(forms[i]);
      if (ep) { addTurnstile(forms[i]); wireForm(forms[i], ep); }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
