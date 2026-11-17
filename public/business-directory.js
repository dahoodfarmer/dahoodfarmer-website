(function () {
  'use strict';

  var searchInput = document.getElementById('directorySearch');
  var countryInput = document.getElementById('directoryCountry');
  var categoryInput = document.getElementById('directoryCategory');
  var searchButton = document.getElementById('directorySearchButton');
  var resultsNode = document.getElementById('directoryResults');
  var countNode = document.getElementById('directoryCount');

  if (!resultsNode || !searchButton) return;

  function makeText(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = text || '';
    return node;
  }

  function renderListings(listings) {
    resultsNode.replaceChildren();
    if (!listings.length) {
      resultsNode.appendChild(makeText('p', 'empty-directory', 'No approved public business listings are available yet. Businesses can apply for consideration through the DHF Business Network.'));
      return;
    }

    listings.forEach(function (listing) {
      var card = makeText('article', 'directory-card', '');
      card.appendChild(makeText('h3', '', listing.business_name));
      if (listing.category) card.appendChild(makeText('p', 'directory-category', listing.category));
      card.appendChild(makeText('p', 'directory-description', listing.description));
      var location = [listing.city, listing.region, listing.country].filter(Boolean).join(', ');
      if (location) card.appendChild(makeText('p', 'directory-location', location));

      if (listing.website) {
        var link = document.createElement('a');
        link.href = listing.website;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Visit website';
        card.appendChild(link);
      }
      resultsNode.appendChild(card);
    });
  }

  async function loadDirectory() {
    var params = new URLSearchParams();
    if (searchInput && searchInput.value.trim()) params.set('q', searchInput.value.trim());
    if (countryInput && countryInput.value.trim()) params.set('country', countryInput.value.trim());
    if (categoryInput && categoryInput.value.trim()) params.set('category', categoryInput.value.trim());

    countNode.textContent = 'Searching approved listings…';
    searchButton.disabled = true;
    try {
      var response = await fetch('/api/business-directory?' + params.toString(), {
        headers: { 'Accept': 'application/json' }
      });
      var data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Directory unavailable');
      renderListings(data.listings || []);
      countNode.textContent = (data.total || 0) + ' approved business listing(s).';
    } catch (error) {
      resultsNode.replaceChildren(makeText('p', 'empty-directory', 'The directory is temporarily unavailable. Please try again later.'));
      countNode.textContent = 'Directory unavailable.';
    } finally {
      searchButton.disabled = false;
    }
  }

  searchButton.addEventListener('click', loadDirectory);
  [searchInput, countryInput, categoryInput].forEach(function (input) {
    if (input) input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        loadDirectory();
      }
    });
  });

  loadDirectory();
})();
