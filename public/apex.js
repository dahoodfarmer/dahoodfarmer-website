(function () {
  'use strict';
  if (document.getElementById('dhf-apex-root')) return;
  var attributionToken = '', conversationId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  var history = [], widgetId = null, turnstileToken = '', busy = false, opened = false, openedOnce = false;
  var root = document.createElement('div');
  root.id = 'dhf-apex-root';
  root.innerHTML = '<button class="apex-launcher" type="button" aria-label="Chat with DHF APEX" aria-expanded="false"><span class="apex-launcher-crown" aria-hidden="true">♛</span><span class="apex-launcher-label">Ask APEX</span></button>' +
    '<section class="apex-panel" role="dialog" aria-label="DHF APEX assistant" aria-modal="false" hidden>' +
      '<header class="apex-header"><div><span class="apex-kicker">DA HOODFARMER INTELLIGENCE</span><strong>DHF APEX</strong><small>Business • Agriculture • Media • More</small></div><button class="apex-close" type="button" aria-label="Close chat">×</button></header>' +
      '<div class="apex-notice">AI assistant. Verify important information. Do not share private or payment information.</div>' +
      '<div class="apex-messages" aria-live="polite" aria-relevant="additions text"><div class="apex-message apex-assistant">Welcome. I’m APEX. What would you like to know about Da HoodFarmer, agriculture, business opportunities, media, or working together?</div></div>' +
      '<div class="apex-suggestions"><button type="button" data-prompt="Tell me about Da HoodFarmer.">The brand</button><button type="button" data-prompt="How can I work with Da HoodFarmer?">Work together</button><button type="button" data-prompt="What agricultural topics can you help with?">Agriculture</button></div>' +
      '<div class="apex-security" aria-label="Spam protection"><div class="cf-turnstile apex-turnstile"></div></div>' +
      '<form class="apex-form"><label class="apex-sr-only" for="apex-input">Your message</label><textarea id="apex-input" maxlength="2200" rows="2" placeholder="Ask APEX a question..." required></textarea><button class="apex-send" type="submit" aria-label="Send message" disabled>↑</button></form>' +
      '<footer class="apex-footer"><span>Private session · No transcript stored by this site</span><button type="button" class="apex-clear">Clear chat</button><div class="apex-links"><a href="/booking">Booking</a><a href="/contact">Contact</a></div></footer>' +
    '</section>';
  document.body.appendChild(root);
  var launcher = root.querySelector('.apex-launcher'), panel = root.querySelector('.apex-panel');
  var close = root.querySelector('.apex-close'), form = root.querySelector('.apex-form');
  var input = root.querySelector('#apex-input'), send = root.querySelector('.apex-send');
  var messages = root.querySelector('.apex-messages'), security = root.querySelector('.apex-security');

  function appendMessage(text, role) {
    var node = document.createElement('div');
    node.className = 'apex-message ' + (role === 'user' ? 'apex-user' : 'apex-assistant');
    node.textContent = text;
    messages.appendChild(node);
    messages.scrollTop = messages.scrollHeight;
    return node;
  }
  function logEvent(eventType, targetPath) {
    fetch('/api/apex/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventType: eventType, targetPath: targetPath || null, conversationId: conversationId }) }).catch(function () {});
  }
  function setOpen(value) {
    opened = value;
    if (value && !openedOnce) { openedOnce = true; logEvent('widget_open'); } panel.hidden = !value;
    launcher.setAttribute('aria-expanded', String(value));
    if (value) {
      input.focus();
      if (!window.TURNSTILE_SITE_KEY) {
        security.textContent = 'Security verification is not configured yet. APEX will become available after setup.';
        send.disabled = true;
      } else mountTurnstile();
    }
  }
  function mountTurnstile() {
    if (widgetId !== null || !window.turnstile || !window.TURNSTILE_SITE_KEY) return;
    try {
      widgetId = window.turnstile.render(root.querySelector('.apex-turnstile'), {
        sitekey: window.TURNSTILE_SITE_KEY,
        action: 'apex_chat',
        callback: function (token) { turnstileToken = token; send.disabled = false; },
        'expired-callback': function () { turnstileToken = ''; send.disabled = true; },
        'error-callback': function () { turnstileToken = ''; send.disabled = true; }
      });
      send.disabled = true;
    } catch (error) { security.textContent = 'Security verification could not load. Refresh the page and try again.'; }
  }
  function resetTurnstile() {
    turnstileToken = '';
    if (widgetId !== null && window.turnstile) { try { window.turnstile.reset(widgetId); } catch (error) {} }
    send.disabled = true;
  }
  function addSources(node, sources) {
    if (!Array.isArray(sources) || !sources.length) return;
    var valid = sources.filter(function (source) {
      try { return source && new URL(source.url).origin === 'https://dahoodfarmer.com'; }
      catch (error) { return false; }
    });
    if (!valid.length) return;
    var box = document.createElement('div');
    box.className = 'apex-sources';
    var label = document.createElement('span');
    label.textContent = 'Sources: ';
    box.appendChild(label);
    valid.forEach(function (source, index) {
      if (index) box.appendChild(document.createTextNode(' · '));
      var link = document.createElement('a');
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = source.title || 'Da HoodFarmer';
      box.appendChild(link);
    });
    node.appendChild(box);
  }
  function addFeedback(node, id) {
    var group = document.createElement('div'); group.className = 'apex-feedback';
    var up = document.createElement('button'), down = document.createElement('button');
    up.type = down.type = 'button'; up.textContent = 'Helpful'; down.textContent = 'Not helpful';
    function submit(value) {
      up.disabled = true; down.disabled = true;
      fetch('/api/apex/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: id, rating: value }) }).catch(function () {});
      group.textContent = 'Thanks for the feedback.';
    }
    up.addEventListener('click', function () { submit('helpful'); });
    down.addEventListener('click', function () { submit('not_helpful'); });
    group.appendChild(up); group.appendChild(down); node.appendChild(group);
  }
  async function submitMessage(value) {
    if (busy || !value || value.length > 2200) return;
    if (!turnstileToken) { appendMessage('Please complete the security check before sending a message.', 'assistant'); return; }
    busy = true; send.disabled = true;
    appendMessage(value, 'user');
    var pending = appendMessage('APEX is thinking…', 'assistant');
    input.value = '';
    try {
      var response = await fetch('/api/apex/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: value, history: history.slice(-6), conversationId: conversationId, turnstileToken: turnstileToken })
      });
      var data = await response.json();
      if (!response.ok) throw new Error(data.error || 'APEX is temporarily unavailable.');
      pending.textContent = data.answer;
      attributionToken = data.apexRef || '';
      addSources(pending, data.sources);
      addFeedback(pending, data.conversationId || conversationId);
      history.push({ role: 'user', content: value }, { role: 'assistant', content: data.answer });
      history = history.slice(-8);
    } catch (error) {
      pending.textContent = error.message || 'Unable to reach APEX. Please try again.';
    } finally { busy = false; resetTurnstile(); input.focus(); }
  }
  launcher.addEventListener('click', function () { setOpen(!opened); });
  close.addEventListener('click', function () { setOpen(false); });
  root.querySelector('.apex-clear').addEventListener('click', function () {
    history = []; messages.innerHTML = ''; appendMessage('Chat cleared. What would you like to explore?', 'assistant');
  });
  root.querySelectorAll('[data-prompt]').forEach(function (button) {
    button.addEventListener('click', function () { input.value = button.getAttribute('data-prompt') || ''; input.focus(); });
  });
  form.addEventListener('submit', function (event) { event.preventDefault(); var value = input.value.trim(); if (value) submitMessage(value); });
  root.querySelectorAll('.apex-links a').forEach(function (link) { link.addEventListener('click', function () { var target = new URL(link.href); if (attributionToken) target.searchParams.set('apex_ref', attributionToken); link.href = target.toString(); logEvent('cta_click', target.pathname); }); });
  input.addEventListener('keydown', function (event) { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); } });
  if (window.turnstile) mountTurnstile();
  else {
    var started = Date.now();
    var poll = window.setInterval(function () {
      if (window.turnstile) { window.clearInterval(poll); mountTurnstile(); }
      else if (Date.now() - started > 12000) window.clearInterval(poll);
    }, 200);
  }
})();
