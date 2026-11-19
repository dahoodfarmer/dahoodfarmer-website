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
  function showUnavailable(message) {
    host.replaceChildren(el('p', 'muted', message));
    if (status) status.textContent = 'Payment collection is not active. DHF will provide verified direct bank-transfer instructions separately after the business settlement account and procedures are approved. Do not send money to an unverified destination.';
  }
  fetch('/api/payment-options', { headers: { Accept: 'application/json' }, cache: 'no-store' })
    .then(function (response) {
      if (!response.ok) throw new Error('Payment configuration unavailable');
      return response.json();
    })
    .then(function (data) {
      if (!data || data.payment_status !== 'disabled' || !Array.isArray(data.methods) || data.methods.length) {
        showUnavailable('No customer payment destination is active. Contact Da HoodFarmer through the official contact page before sending money.');
        return;
      }
      showUnavailable('Direct bank-transfer instructions are not published yet. They will appear only after DHF verifies and approves its business settlement account.');
    })
    .catch(function () {
      showUnavailable('Payment instructions could not be verified. Contact Da HoodFarmer through the official contact page. Do not send payment.');
    });
})();
