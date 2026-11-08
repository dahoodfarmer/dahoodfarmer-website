(function () {
  'use strict';

  var siteKey = window.TURNSTILE_SITE_KEY || '';
  var widgets = new WeakMap();

  function showMessage(form, message, success) {
    var node = form.querySelector('.form-message');
    if (!node) {
      node = document.createElement('div');
      node.className = 'form-message';
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      node.style.cssText = 'padding:12px 16px;margin:12px 0;border-radius:8px;font-size:14px;';
      form.appendChild(node);
    }
    node.textContent = message;
    node.style.background = success ? '#d4edda' : '#f8d7da';
    node.style.color = success ? '#155724' : '#721c24';
    node.style.border = '1px solid ' + (success ? '#c3e6cb' : '#f5c6cb');
  }

  function endpointFor(form) {
    var fields = Array.prototype.map.call(form.querySelectorAll('input, textarea, select'), function (field) {
      return (field.name || '').toLowerCase();
    }).filter(Boolean);
    var path = window.location.pathname.toLowerCase();
    if (fields.indexOf('inquiry_type') !== -1 || path.indexOf('booking') !== -1) return '/api/booking';
    if (fields.indexOf('message') !== -1 || form.querySelector('textarea') || path.indexOf('contact') !== -1) return '/api/contact';
    if (fields.indexOf('email') !== -1 && fields.every(function (field) { return field === 'email' || field === 'consent'; })) return '/api/newsletter';
    return null;
  }

  function loadTurnstile(callback) {
    if (window.turnstile) {
      callback();
      return;
    }
    var script = document.querySelector('script[src*="challenges.cloudflare.com/turnstile/v0/api.js"]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    var finished = false;
    var started = Date.now();
    function check() {
      if (finished) return;
      if (window.turnstile) {
        finished = true;
        callback();
      } else if (Date.now() - started < 15000) {
        window.setTimeout(check, 100);
      } else {
        finished = true;
      }
    }
    script.addEventListener('load', check, { once: true });
    script.addEventListener('error', function () { finished = true; }, { once: true });
    check();
  }

  function mountTurnstile(form) {
    if (!siteKey) return;
    var target = form.querySelector('.cf-turnstile');
    if (!target) {
      target = document.createElement('div');
      target.className = 'cf-turnstile';
      target.style.margin = '12px 0';
      var button = form.querySelector('button[type="submit"], input[type="submit"]');
      if (button && button.parentNode) button.parentNode.insertBefore(target, button);
      else form.appendChild(target);
    }
    loadTurnstile(function () {
      if (widgets.has(form)) return;
      try {
        var id = window.turnstile.render(target, {
          sitekey: siteKey,
          callback: function () {},
          'expired-callback': function () {},
          'error-callback': function () {}
        });
        widgets.set(form, id);
      } catch (error) {
        showMessage(form, 'Spam protection could not load. Refresh the page and try again.', false);
      }
    });
  }

  function serialize(form) {
    var data = {};
    Array.prototype.forEach.call(form.querySelectorAll('input, textarea, select'), function (field) {
      if (!field.name || field.disabled || field.name === 'cf-turnstile-response') return;
      if ((field.type === 'checkbox' || field.type === 'radio') && !field.checked) return;
      data[field.name] = field.type === 'checkbox' ? (field.checked ? 'true' : '') : field.value;
    });
    return data;
  }

  function attach(form, endpoint) {
    if (form.dataset.dhfFormHandler === 'attached') return;
    form.dataset.dhfFormHandler = 'attached';
    mountTurnstile(form);
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (!siteKey) {
        showMessage(form, 'This form is temporarily unavailable. Please contact Hoodfarmer202@gmail.com directly.', false);
        return;
      }
      if (!window.turnstile || !widgets.has(form)) {
        showMessage(form, 'Security check is loading. Wait a moment and try again.', false);
        return;
      }
      var widgetId = widgets.get(form);
      var token = window.turnstile.getResponse(widgetId);
      if (!token) {
        showMessage(form, 'Complete the Cloudflare security check before submitting.', false);
        return;
      }

      var button = form.querySelector('button[type="submit"], input[type="submit"]');
      var original = button ? (button.tagName === 'INPUT' ? button.value : button.textContent) : '';
      if (button) {
        button.disabled = true;
        if (button.tagName === 'INPUT') button.value = 'Sending...';
        else button.textContent = 'Sending...';
      }
      try {
        var data = serialize(form);
        data['cf-turnstile-response'] = token;
        var response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        var result = await response.json();
        if (!response.ok || !result.success) {
          showMessage(form, result.error || 'Your submission could not be sent. Please try again.', false);
          window.turnstile.reset(widgetId);
          return;
        }
        showMessage(form, result.message || 'Your submission was received.', true);
        form.reset();
        window.turnstile.reset(widgetId);
      } catch (error) {
        showMessage(form, 'A network error occurred. Check your connection and try again.', false);
        if (window.turnstile && widgets.has(form)) window.turnstile.reset(widgets.get(form));
      } finally {
        if (button) {
          button.disabled = false;
          if (button.tagName === 'INPUT') button.value = original;
          else button.textContent = original;
        }
      }
    });
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('form'), function (form) {
      if (form.getAttribute('role') === 'search') return;
      var endpoint = endpointFor(form);
      if (endpoint) attach(form, endpoint);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
