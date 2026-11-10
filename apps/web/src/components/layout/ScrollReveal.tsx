import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** What reveals: cards, stat tiles, and anything marked `.pp-reveal`, inside the page area. */
const TARGETS = ".ant-layout-content .ant-card, .ant-layout-content .pp-tile, .ant-layout-content .pp-reveal";

/**
 * Brings content in as it scrolls into view. Things below the fold start
 * faded and a little lower (data-reveal="pending") and rise in when they
 * enter the viewport, a few at a time; things already on screen keep the
 * page entrance. Off with reduced motion, without IntersectionObserver, and
 * in print (global.css). Renders nothing.
 */
export function ScrollReveal() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let batch = 0;
    let batchTimer = 0;
    const timers = new Set<number>();
    const later = (fn: () => void, ms: number) => {
      const t = window.setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
    };

    const reveal = (el: HTMLElement) => {
      if (el.dataset.reveal !== "pending") return;
      // Items arriving together stagger slightly; the count resets once the burst ends.
      el.style.transitionDelay = `${Math.min(batch++, 4) * 70}ms`;
      window.clearTimeout(batchTimer);
      batchTimer = window.setTimeout(() => (batch = 0), 120);
      el.dataset.reveal = "in";
      later(() => {
        el.dataset.reveal = "done";
        el.style.transitionDelay = "";
      }, 900);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          io.unobserve(e.target);
          reveal(e.target as HTMLElement);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );

    // The first look at a page is covered by its entrance animation. Cards that
    // turn up later (data arriving after a skeleton, a new item) animate in place.
    let first = true;
    const scan = () => {
      const fold = window.innerHeight * 0.95;
      document.querySelectorAll<HTMLElement>(TARGETS).forEach((el) => {
        if (el.dataset.reveal) return;
        // Inside something already revealing? Let the parent carry it.
        if (el.parentElement?.closest("[data-reveal=pending]")) {
          el.dataset.reveal = "done";
          return;
        }
        if (el.getBoundingClientRect().top > fold) {
          el.dataset.reveal = "pending";
          // Revealed when it scrolls (or a resize brings it) into view; leaving the page shows it too.
          io.observe(el);
        } else if (first) {
          el.dataset.reveal = "done";
        } else {
          el.dataset.reveal = "pending";
          requestAnimationFrame(() => requestAnimationFrame(() => reveal(el)));
        }
      });
      first = false;
    };

    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(scan);
    };
    schedule();
    const mo = new MutationObserver(schedule);
    const root = document.querySelector(".ant-layout-content") ?? document.body;
    mo.observe(root, { childList: true, subtree: true });

    // Printing, or a resize that brings things into view, shows everything that's waiting.
    const showAll = () =>
      document.querySelectorAll<HTMLElement>("[data-reveal=pending]").forEach((el) => {
        el.dataset.reveal = "done";
        io.unobserve(el);
      });
    window.addEventListener("beforeprint", showAll);

    return () => {
      mo.disconnect();
      io.disconnect();
      cancelAnimationFrame(frame);
      window.clearTimeout(batchTimer);
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("beforeprint", showAll);
      showAll();
    };
  }, [pathname]);

  return null;
}
