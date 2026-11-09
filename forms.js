(function () {
  'use strict';

  function getSiteKey(form) {
    var target = form.querySelector('.cf-turnstile');
    return window.TURNSTILE_SITE_KEY ||
      (target && target.getAttribute('data-sitekey')) || '';
  }
  var widgets = Object.create(null);
  var widgetReady = Object.create(null);
  var widgetTokens = Object.create(null);

  function endpointForPath() {
    var path = window.location.pathname;
    if (path === '/contact' || path === '/contact.html') return '/api/contact';
    if (path === '/booking' || path === '/booking.html') return '/api/booking';
    return null;
  }

  function findNewsletterForm() {
    // Only bind forms explicitly marked as newsletter forms. The global
    // middleware also loads this script on unsubscribe and admin pages.
    var forms = document.querySelectorAll('form[data-newsletter="true"]');
    for (var i = 0; i < forms.length; i++) {
      var form = forms[i];
      if (form.querySelector('input[type="email"][name="email"]')) {
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

  function ensureTurnstileScript(callback, onError) {
    var finished = false;
    var retried = false;
    var timeoutId = window.setTimeout(function () {
      if (!finished) failed();
    }, 10000);

    function ready() {
      if (finished || !window.turnstile) return;
      finished = true;
      window.clearTimeout(timeoutId);
      callback();
    }

    function failed() {
      if (finished) return;
      if (retried) {
        finished = true;
        window.clearTimeout(timeoutId);
        if (onError) onError();
        return;
      }
      retried = true;
      window.clearTimeout(timeoutId);
      // A pre-existing script may have failed before this handler was attached.
      var existing = document.querySelector('script[src*="challenges.cloudflare.com/turnstile/v0/api.js"]');
      if (existing && !window.turnstile) existing.remove();

      timeoutId = window.setTimeout(function () {
        if (!finished) {
          finished = true;
          if (onError) onError();
        }
      }, 15000);

      var retry = document.createElement('script');
      retry.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      retry.async = true;
      retry.defer = true;
      retry.onload = function () {
        if (window.turnstile) ready();
        else if (onError && !finished) {
          finished = true;
          window.clearTimeout(timeoutId);
          onError();
        }
      };
      retry.onerror = function () {
        if (!finished) {
          finished = true;
          window.clearTimeout(timeoutId);
          if (onError) onError();
        }
      };
      document.head.appendChild(retry);
    }

    if (window.turnstile) {
      ready();
      return;
    }

    var existing = document.querySelector('script[src*="challenges.cloudflare.com/turnstile/v0/api.js"]');
    if (existing) {
      existing.addEventListener('load', ready, { once: true });
      existing.addEventListener('error', failed, { once: true });
    } else {
      failed();
    }

    // Also cover the case where an existing script finished before listeners attached.
    (function poll() {
      if (finished) return;
      if (window.turnstile) {
        ready();
      } else {
        window.setTimeout(poll, 100);
      }
    })();
  }

  function mountTurnstile(form, id) {
    var siteKey = getSiteKey(form);
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
          callback: function (token) { widgetTokens[id] = token || ''; widgetReady[id] = !!token; },
          'expired-callback': function () { widgetTokens[id] = ''; widgetReady[id] = false; },
          'error-callback': function () { widgetTokens[id] = ''; widgetReady[id] = false; }
        });
        widgetReady[id] = false;
      } catch (error) {
        showMessage(form, 'Spam protection could not load. Please refresh the page and try again.', false);
      }
    }, function () {
      showMessage(form, 'Cloudflare security verification could not load. Check your connection, refresh, and try again.', false);
    });
  }

  function attachForm(config, id) {
    if (!config || !config.form) return;
    var form = config.form;
    if (form.dataset.dhfFormHandler === 'attached') return;
    form.dataset.dhfFormHandler = 'attached';
    var endpoint = config.endpoint;
    var button = form.querySelector('button[type="submit"]');
    var originalLabel = button ? button.textContent : 'Submit';

    mountTurnstile(form, id);

    form.addEventListener('submit', async function (event) {
      event.preventDefault();

      if (!getSiteKey(form)) {
        showMessage(form, 'This form is temporarily unavailable because spam protection is not configured. Please contact the site owner.', false);
        return;
      }
      if (!window.turnstile || widgets[id] === undefined) {
        showMessage(form, 'Spam protection is still loading. Please wait a moment and try again.', false);
        return;
      }

      var token = window.turnstile.getResponse(widgets[id]) || widgetTokens[id] || '';
      if (!token) {
        var responseField = form.querySelector('input[name="cf-turnstile-response"], textarea[name="cf-turnstile-response"]');
        if (responseField) token = responseField.value || '';
      }
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
        widgetTokens[id] = '';
        widgetReady[id] = false;
      } catch (error) {
        showMessage(form, error.message || 'Network error. Please check your connection and try again.', false);
        if (window.turnstile && widgets[id] !== undefined) window.turnstile.reset(widgets[id]);
        widgetTokens[id] = '';
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
