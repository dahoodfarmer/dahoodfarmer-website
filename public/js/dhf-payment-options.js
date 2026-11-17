(function () {
  'use strict';
  var host = document.getElementById('external-payment-options');
  if (!host) return;
  var status = document.getElementById('external-payment-status');
  function el(tag, className, value) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  }
  function render(methods) {
    host.replaceChildren();
    if (!methods.length) {
      host.appendChild(el('p', 'muted', 'No external payment destination has been configured for this invoice yet. Contact Da HoodFarmer through the official contact page before sending money.'));
      if (status) status.textContent = 'No customer payment destination is active. Do not send payment until an official destination appears here or is independently confirmed.';
      return;
    }
    methods.forEach(function (method) {
      var card = el('article', 'external-payment-option');
      var title = el('h3', '', method.label);
      var note = el('p', 'muted', 'Continue to the official ' + method.label + ' destination. Enter the exact invoice amount and include the invoice number in the payment note or message.');
      var link = el('a', 'external-payment-link', 'Continue to ' + method.label);
      link.href = method.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer nofollow';
      var qr = el('div', 'external-payment-qr');
      qr.setAttribute('aria-label', method.label + ' payment destination QR code');
      card.append(title, note, link, qr);
      host.appendChild(card);
      if (typeof QRCode === 'function') {
        new QRCode(qr, { text: method.url, width: 164, height: 164, colorDark: '#171717', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
      }
    });
    if (status) status.textContent = 'These links open DHF-configured external payment services. Payments are not automatically verified; your invoice remains unpaid until DHF confirms receipt.';
  }
  fetch('/api/payment-options', { headers: { Accept: 'application/json' }, cache: 'no-store' })
    .then(function (response) { if (!response.ok) throw new Error('Payment options unavailable'); return response.json(); })
    .then(function (data) { render(Array.isArray(data.methods) ? data.methods : []); })
    .catch(function () {
      host.replaceChildren(el('p', 'muted', 'Payment destinations could not be loaded. Contact Da HoodFarmer through the official contact page before sending money.'));
      if (status) status.textContent = 'Payment destinations could not be verified. Do not send payment.';
    });
})();
