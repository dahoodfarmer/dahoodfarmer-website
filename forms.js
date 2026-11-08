(function () {
  'use strict';

  var siteKey = window.TURNSTILE_SITE_KEY || '';
  var widgets = Object.create(null);
  var widgetReady = Object.create(null);

  function endpointForPath() {
    var path = window.location.pathname;
    if (path === '/contact' || path === '/contact.html') return '/api/contact';
    if (path === '/booking' || path === '/booking.html') return '/api/booking';
    return null;
  }

  function findNewsletterForm() {
    var forms = document.querySelectorAll('form');
    for (var i = 0; i < forms.length; i++) {
      var form = forms[i];
      if (form.querySelector('input[name="email"]') &&
          !form.querySelector('input[name="name"]') &&
          form.dataset.newsletter !== 'false') {
        return { form: form, endpoint: '/api/newsletter' };
      }
    }
    return null;
  }

  function serialize(form) {
    var data = {};
    form.querySelectorAll('input, textarea, select').forEach(function (field) {
      if (!field.name || field.disabled) return;
      if (field.type === 'checkbox') {
        data[field.name] = field.checked;
      } else if (field.type === 'radio') {
        if (field.checked) data[field.name] = field.value;
      } else {
        data[field.name] = field.value;
      }
    });
    return data;
  }

  function showMessage(form, message, success) {
    var node = form.querySelector('.form-message');
    if (!node) {
      node = document.createElement('div');
      node.className = 'form-message';
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      node.style.cssText = 'padding:1rem;margin-top:1rem;border-radius:6px;text-align:center;font-size:.95rem';
      form.appendChild(node);
    }
    node.textContent = message;
    node.style.background = success ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.15)';
    node.style.color = success ? '#22c55e' : '#ef4444';
    node.style.border = '1px solid ' + (success ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)');
  }

  function ensureTurnstileScript(callback) {
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

    var started = Date.now();
    (function waitForApi() {
      if (window.turnstile) {
        callback();
      } else if (Date.now() - started < 15000) {
        window.setTimeout(waitForApi, 100);
      }
    })();
  }

  function mountTurnstile(form, id) {
    if (!siteKey) return;
    var target = form.querySelector('.cf-turnstile');
    if (!target) {
      target = document.createElement('div');
      target.className = 'cf-turnstile';
      target.style.cssText = 'margin:1rem 0;';
      var button = form.querySelector('button[type="submit"]');
      if (button) button.parentNode.insertBefore(target, button);
      else form.appendChild(target);
    }

    ensureTurnstileScript(function () {
      if (widgets[id] !== undefined) return;
      try {
        widgets[id] = window.turnstile.render(target, {
          sitekey: siteKey,
          callback: function () { widgetReady[id] = true; },
          'expired-callback': function () { widgetReady[id] = false; },
          'error-callback': function () { widgetReady[id] = false; }
        });
        widgetReady[id] = false;
      } catch (error) {
        showMessage(form, 'Spam protection could not load. Please refresh the page and try again.', false);
      }
    });
  }

  function attachForm(config, id) {
    if (!config || !config.form) return;
    var form = config.form;
    var endpoint = config.endpoint;
    var button = form.querySelector('button[type="submit"]');
    var originalLabel = button ? button.textContent : 'Submit';

    mountTurnstile(form, id);

    form.addEventListener('submit', async function (event) {
      event.preventDefault();

      if (!siteKey) {
        showMessage(form, 'This form is temporarily unavailable because spam protection is not configured. Please contact the site owner.', false);
        return;
      }
      if (!window.turnstile || widgets[id] === undefined) {
        showMessage(form, 'Spam protection is still loading. Please wait a moment and try again.', false);
        return;
      }

      var token = window.turnstile.getResponse(widgets[id]);
      if (!token) {
        showMessage(form, 'Please complete the Cloudflare security check before sending your message.', false);
        return;
      }

      if (button) {
        button.disabled = true;
        button.textContent = 'Sending...';
      }

      try {
        var data = serialize(form);
        data['cf-turnstile-response'] = token;

        if (endpoint === '/api/newsletter') {
          var consent = form.querySelector('input[name="consent"]');
          data.consent = consent && consent.checked ? 'true' : '';
        }

        var response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        var result;
        try {
          result = await response.json();
        } catch (parseError) {
          throw new Error('The server returned an unreadable response. Please try again later.');
        }

        if (!response.ok) {
          showMessage(form, result.error || 'Your message could not be sent. Please try again.', false);
          if (window.turnstile) window.turnstile.reset(widgets[id]);
          return;
        }

        showMessage(form, result.message || 'Thank you. Your submission was received.', true);
        form.reset();
        window.turnstile.reset(widgets[id]);
        widgetReady[id] = false;
      } catch (error) {
        showMessage(form, error.message || 'Network error. Please check your connection and try again.', false);
        if (window.turnstile && widgets[id] !== undefined) window.turnstile.reset(widgets[id]);
        widgetReady[id] = false;
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = originalLabel;
        }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var endpoint = endpointForPath();
    if (endpoint) {
      attachForm({ form: document.querySelector('form.form-container'), endpoint: endpoint }, 'primary');
    }

    var newsletter = findNewsletterForm();
    if (newsletter) attachForm(newsletter, 'newsletter');
  });
})();
