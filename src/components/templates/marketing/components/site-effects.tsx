'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function SiteEffects() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.querySelector('.tensr-marketing');
    const nav = root?.querySelector('.nav');
    const onScroll = () => {
      if (nav) {
        nav.setAttribute('data-scrolled', window.scrollY > 8 ? 'true' : 'false');
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const reveals = root?.querySelectorAll('.reveal') ?? [];
    let io: IntersectionObserver | undefined;
    if ('IntersectionObserver' in window && reveals.length) {
      io = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('in');
              io?.unobserve(entry.target);
            }
          });
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
      );
      reveals.forEach(el => io?.observe(el));
    } else {
      reveals.forEach(el => el.classList.add('in'));
    }

    const toggle = root?.querySelector('[data-bill-toggle]');
    const cleanupFns: Array<() => void> = [];
    if (toggle) {
      const setMode = (mode: string) => {
        toggle.querySelectorAll('button').forEach(button => {
          button.setAttribute('data-on', String(button.getAttribute('data-mode') === mode));
        });
        document.querySelectorAll('.tensr-marketing [data-price]').forEach(el => {
          const price = el.getAttribute(`data-${mode}`);
          if (price) el.textContent = price;
        });
        document.querySelectorAll('.tensr-marketing [data-per]').forEach(el => {
          const unit = el.getAttribute('data-permonth') || '/mo';
          el.textContent = mode === 'annual' ? `${unit} · billed annually` : unit;
        });
      };

      toggle.querySelectorAll('button').forEach(button => {
        const handler = () => setMode(button.getAttribute('data-mode') || 'annual');
        button.addEventListener('click', handler);
        cleanupFns.push(() => button.removeEventListener('click', handler));
      });
      setMode('annual');
    }

    return () => {
      window.removeEventListener('scroll', onScroll);
      io?.disconnect();
      cleanupFns.forEach(fn => fn());
    };
  }, [pathname]);

  return null;
}
