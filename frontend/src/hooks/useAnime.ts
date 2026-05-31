"use client";

import { useEffect, useRef, useCallback } from "react";
import { animate, stagger, svg } from "animejs";

export function useScrollAnime() {
  const observerRef = useRef<IntersectionObserver | null>(null);

  const runAnimation = useCallback((el: HTMLElement) => {
    const type = el.dataset.anime || "fadeUp";
    const delay = parseInt(el.dataset.animeDelay || "0", 10);

    switch (type) {
      case "fadeUp":
        animate(el, { opacity: [0, 1], translateY: [40, 0], duration: 800, delay, ease: "outExpo" });
        break;
      case "fadeIn":
        animate(el, { opacity: [0, 1], duration: 600, delay, ease: "outExpo" });
        break;
      case "scaleIn":
        animate(el, { opacity: [0, 1], scale: [0.8, 1], duration: 700, delay, ease: "outBack" });
        break;
      case "slideLeft":
        animate(el, { opacity: [0, 1], translateX: [-60, 0], duration: 800, delay, ease: "outExpo" });
        break;
      case "slideRight":
        animate(el, { opacity: [0, 1], translateX: [60, 0], duration: 800, delay, ease: "outExpo" });
        break;
      case "stagger":
        el.style.opacity = "1";
        animate(el.children, { opacity: [0, 1], translateY: [30, 0], duration: 600, delay: stagger(100, { start: delay }), ease: "outExpo" });
        break;
      default:
        animate(el, { opacity: [0, 1], translateY: [40, 0], duration: 800, delay, ease: "outExpo" });
    }
  }, []);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            runAnimation(entry.target as HTMLElement);
            observerRef.current?.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.01, rootMargin: "50px 0px 50px 0px" }
    );

    const elements = document.querySelectorAll("[data-anime]");
    elements.forEach((el) => {
      (el as HTMLElement).style.opacity = "0";
      observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [runAnimation]);
}

export function useCountUp(ref: React.RefObject<HTMLElement | null>, target: number, duration = 2000) {
  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const obj = { value: 0 };
          animate(obj, {
            value: target,
            duration,
            ease: "outExpo",
            modifier: (v) => Math.round(v),
            onUpdate: () => {
              if (ref.current) ref.current.textContent = obj.value.toLocaleString();
            },
          });
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, target, duration]);
}

export function usePathDraw(ref: React.RefObject<SVGElement | null>, duration = 1500) {
  useEffect(() => {
    if (!ref.current) return;

    const paths = ref.current.querySelectorAll("path, line, circle, polyline");

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          svg.createDrawable(paths);
          animate(paths, {
            strokeDashoffset: [svg.createDrawable, 0],
            duration,
            delay: stagger(200),
            ease: "inOutQuad",
          });
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, duration]);
}
