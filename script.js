const toggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".primary-nav");
if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  });
  nav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open navigation");
  }));
}
document.getElementById("year").textContent = new Date().getFullYear();

// Pre-select the inquiry topic when a visitor clicks a "work together" link.
const subjectSelect = document.getElementById("cf-subject");
if (subjectSelect) {
  document.querySelectorAll("a[data-subject]").forEach(link => link.addEventListener("click", () => {
    const wanted = link.getAttribute("data-subject");
    const match = Array.from(subjectSelect.options).find(o => o.text === wanted);
    if (match) subjectSelect.value = match.value;
  }));
}

// On the contact page, pre-select the topic passed as ?topic=...
if (subjectSelect) {
  const topic = new URLSearchParams(window.location.search).get("topic");
  if (topic) {
    const match = Array.from(subjectSelect.options).find(o => o.text === topic);
    if (match) subjectSelect.value = match.value;
  }
}

// Old one-page links like /#contact now go to their own pages.
const oldAnchors = { "#story": "/story", "#media": "/media", "#ventures": "/ventures", "#partners": "/work-with-me", "#contact": "/contact" };
if (window.location.pathname === "/" && oldAnchors[window.location.hash]) window.location.replace(oldAnchors[window.location.hash]);
