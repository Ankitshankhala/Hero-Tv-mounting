import { useEffect, useRef, useState } from 'react';

/**
 * Observes when a ref becomes visible in the viewport.
 * `once: true` (default) means it stays true after first intersection.
 * `rootMargin` lets us start loading slightly before the element enters view.
 */
export function useInView<T extends Element = HTMLDivElement>(
  options: { rootMargin?: string; threshold?: number; once?: boolean } = {}
) {
  const { rootMargin = '200px', threshold = 0, once = true } = options;
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { rootMargin, threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, threshold, once]);

  return { ref, inView };
}
