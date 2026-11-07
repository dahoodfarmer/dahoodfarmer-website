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
