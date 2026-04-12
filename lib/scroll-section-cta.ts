/**
 * Smooth-scroll to a section id, then play a short slide-down entrance on the target
 * (hero CTAs: architecture, demo).
 */
export function scrollToSectionWithSlide(elementId: string): void {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  const el = document.getElementById(elementId);
  if (!el) return;

  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (reduced) {
    el.scrollIntoView({ behavior: "auto", block: "start" });
    return;
  }

  const play = () => {
    el.classList.remove("cta-section-slide");
    void el.offsetWidth;
    el.classList.add("cta-section-slide");
    window.setTimeout(() => el.classList.remove("cta-section-slide"), 700);
  };

  let played = false;
  const runOnce = () => {
    if (played) return;
    played = true;
    play();
  };

  el.scrollIntoView({ behavior: "smooth", block: "start" });

  if ("onscrollend" in window) {
    window.addEventListener("scrollend", runOnce, { passive: true, once: true });
  }
  window.setTimeout(runOnce, 720);
}
