// DHF does not currently use hosted third-party payment destinations.
// Keep this compatibility helper fail-closed so stale environment variables
// cannot expose a processor link in the customer payment experience.
export function getConfiguredPaymentDestinations() {
  return [];
}
