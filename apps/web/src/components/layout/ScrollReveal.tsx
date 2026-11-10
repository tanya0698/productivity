import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** What reveals: cards, stat tiles, and anything marked `.pp-reveal`, inside the page area. */
const TARGETS = ".ant-layout-content .ant-card, .ant-layout-content .pp-tile, .ant-layout-content .pp-reveal";

/** How much of an item must be on screen before it animates in. */
const ENTER_RATIO = 0.12;

/**
 * Brings content in every time it scrolls into view, not just the first time.
 *
 * Each card or tile is watched for as long as the page is open. When it
 * leaves the screen completely it quietly resets (data-reveal="pending",
 * invisible, so nobody sees the reset); when it comes back it animates in
 * again, rising from below when you scroll down and dropping from above
 * when you scroll up (data-reveal-from). Things on screen when the page
 * opens ride the page entrance. Off with reduced motion, without
 * IntersectionObserver, and in print (global.css). Renders nothing.
 */
export function ScrollReveal() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let batch = 0;
    let batchTimer = 0;
    const settle = new Map<HTMLElement, number>();
    const watched = new Set<HTMLElement>();

    const clearSettle = (el: HTMLElement) => {
      const t = settle.get(el);
      if (t !== undefined) window.clearTimeout(t);
      settle.delete(el);
    };

    const hide = (el: HTMLElement, from: "above" | "below") => {
      clearSettle(el);
      el.style.transitionDelay = "";
      el.dataset.revealFrom = from;
      el.dataset.reveal = "pending";
    };

    const reveal = (el: HTMLElement) => {
      if (el.dataset.reveal !== "pending") return;
      // Items arriving together stagger slightly; the count resets once the burst ends.
      el.style.transitionDelay = `${Math.min(batch++, 4) * 70}ms`;
      window.clearTimeout(batchTimer);
      batchTimer = window.setTimeout(() => (batch = 0), 120);
      el.dataset.reveal = "in";
      clearSettle(el);
      settle.set(
        el,
        window.setTimeout(() => {
          settle.delete(el);
          if (el.dataset.reveal !== "in") return;
          el.dataset.reveal = "done";
          el.style.transitionDelay = "";
        }, 1000),
      );
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const el = e.target as HTMLElement;
          if (!el.isConnected) {
            io.unobserve(el);
            watched.delete(el);
            continue;
          }
          // A card taller than the screen may never be 12% visible; it comes in as soon as it shows.
          const tall = e.boundingClientRect.height > window.innerHeight * 0.8;
          if (e.isIntersecting && (tall || e.intersectionRatio >= ENTER_RATIO)) {
            reveal(el);
          } else if (!e.isIntersecting && el.dataset.reveal !== "pending") {
            // Fully off screen: reset, ready to come in from the side it left by.
            hide(el, e.boundingClientRect.top < 0 ? "above" : "below");
          }
        }
      },
      { threshold: [0, ENTER_RATIO] },
    );

    const watch = (el: HTMLElement) => {
      if (watched.has(el)) return;
      watched.add(el);
      io.observe(el);
    };

    // The first look at a page is covered by its entrance animation. Cards that
    // turn up later (data arriving after a skeleton, a new item) animate in place.
    let first = true;
    const scan = () => {
      const fold = window.innerHeight * 0.95;
      document.querySelectorAll<HTMLElement>(TARGETS).forEach((el) => {
        if (el.dataset.reveal) return;
        // Inside something that reveals already? Let the parent carry it.
        if (el.parentElement?.closest("[data-reveal]")) {
          el.dataset.reveal = "nested";
          return;
        }
        const rect = el.getBoundingClientRect();
        if (rect.top > fold || rect.bottom < 0) {
          hide(el, rect.bottom < 0 ? "above" : "below");
        } else if (first) {
          el.dataset.reveal = "done";
        } else {
          hide(el, "below");
          requestAnimationFrame(() => requestAnimationFrame(() => reveal(el)));
        }
        watch(el);
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

    // Printing shows everything at once.
    const showAll = () =>
      document.querySelectorAll<HTMLElement>("[data-reveal=pending], [data-reveal=in]").forEach((el) => {
        clearSettle(el);
        el.style.transitionDelay = "";
        el.dataset.reveal = "done";
      });
    window.addEventListener("beforeprint", showAll);

    return () => {
      mo.disconnect();
      io.disconnect();
      cancelAnimationFrame(frame);
      window.clearTimeout(batchTimer);
      settle.forEach((t) => window.clearTimeout(t));
      settle.clear();
      watched.clear();
      window.removeEventListener("beforeprint", showAll);
      showAll();
    };
  }, [pathname]);

  return null;
}
