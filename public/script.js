const headerHTML='<header class="site-header" id="siteHeader"><a href="/" class="brand"><span class="brand-crown">👑</span><span class="brand-name">DA <span>HOODFARMER</span></span></a><button class="nav-toggle" id="navToggle" aria-label="Menu">☰</button><ul class="nav-links" id="navLinks"><li><a href="/" data-page="home">Home</a></li><li><a href="/about" data-page="about">About</a></li><li><a href="/agriculture" data-page="agriculture">Agriculture</a></li><li><a href="/resources" data-page="resources">Resources</a></li><li><a href="/advertise" data-page="advertise">Advertise</a></li><li><a href="/editorial-standards" data-page="editorial-standards">Editorial Standards</a></li><li><a href="/media" data-page="media">TV & Media</a></li><li><a href="/healing-aint-soft" data-page="healing-aint-soft">Healing Ain\'t Soft</a></li><li><a href="/business" data-page="business">Ventures</a></li><li><a href="/shop" data-page="shop">Shop</a></li><li><a href="/booking" data-page="booking">Bookings</a></li><li><a href="/community" data-page="community">Community</a></li><li><a href="/contact" data-page="contact">Contact</a></li></ul><div class="theme-control"><label for="themeSelect">Appearance</label><select id="themeSelect" aria-label="Choose website appearance"><option value="royal-ranch">Royal Ranch</option><option value="western-heritage">Western Heritage</option><option value="agtech-future">AgTech Future</option><option value="entertainment">Entertainment Mode</option><option value="executive">Executive</option></select></div></header>';
const footerHTML='<footer class="site-footer"><div class="footer-grid"><div class="footer-col"><h4>👑 Da HoodFarmer</h4><p style="color:var(--text-dim);font-size:.9rem;">Farmer. Cowboy. Entrepreneur. TV Personality. Community Advocate.</p></div><div class="footer-col"><h4>Explore</h4><a href="/about">About</a><a href="/agriculture">Agriculture</a><a href="/resources">Resource Center</a><a href="/media">TV & Media</a><a href="/business">Ventures</a><a href="/community">Community</a></div><div class="footer-col"><h4>Connect</h4><a href="/contact">Contact</a><a href="/booking">Bookings</a><a href="/press-kit">Press Kit</a><a href="/advertise">Advertise & Sponsor</a><a href="/shop">Shop</a></div><div class="footer-col"><h4>Follow</h4><div class="social-links"><a href="https://linktr.ee/dahoodfarmer" target="_blank" rel="noopener" title="Linktree">🔗</a></div><h4 style="margin-top:1.5rem;">Legal</h4><a href="/privacy-policy">Privacy Policy</a><a href="/terms">Terms</a><a href="/affiliate-disclosure">Affiliate Disclosure</a></div></div><div class="footer-bottom"><p>&copy; 2026 Da HoodFarmer. All rights reserved. 👑 ★</p></div></footer>';
const THEME_STORAGE_KEY = "dhf-theme-v1";
const AVAILABLE_THEMES = new Set(["royal-ranch", "western-heritage", "agtech-future", "entertainment", "executive"]);
function applySiteTheme(theme, persist = false) {
  const selected = AVAILABLE_THEMES.has(theme) ? theme : "royal-ranch";
  document.documentElement.dataset.theme = selected;
  const selector = document.getElementById("themeSelect");
  if (selector) selector.value = selected;
  if (persist) {
    try { window.localStorage.setItem(THEME_STORAGE_KEY, selected); } catch (_) { /* Storage may be unavailable; the page remains usable. */ }
  }
}
function initializeThemeControl() {
  let savedTheme = "royal-ranch";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (AVAILABLE_THEMES.has(stored)) savedTheme = stored;
  } catch (_) { /* Private browsing or storage restrictions fall back to Royal Ranch. */ }
  applySiteTheme(savedTheme);
  const selector = document.getElementById("themeSelect");
  if (selector) selector.addEventListener("change", () => applySiteTheme(selector.value, true));
}

function injectLayout(){document.body.insertAdjacentHTML('afterbegin',headerHTML);document.body.insertAdjacentHTML('beforeend',footerHTML);initializeThemeControl();var path=window.location.pathname.replace(/\.html$/,'').replace(/^\//,'')||'home';document.querySelectorAll('.nav-links a').forEach(function(link){var page=link.getAttribute('data-page');if(page===path||(path==='home'&&page==='home')||(path.indexOf('resources/')===0&&page==='resources'))link.classList.add('active')});var toggle=document.getElementById('navToggle');var links=document.getElementById('navLinks');if(toggle)toggle.addEventListener('click',function(){links.classList.toggle('open');toggle.textContent=links.classList.contains('open')?'✕':'☰'});var header=document.getElementById('siteHeader');window.addEventListener('scroll',function(){if(window.scrollY>50)header.classList.add('scrolled');else header.classList.remove('scrolled')});document.querySelectorAll('.nav-links a').forEach(function(link){link.addEventListener('click',function(){links.classList.remove('open');if(toggle)toggle.textContent='☰'})})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',injectLayout);else injectLayout();
