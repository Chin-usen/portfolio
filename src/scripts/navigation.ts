// Native dialog supplies modality; explicit Tab wrapping also keeps focus out of browser chrome.
// All per-header listeners are removed on swap.
class SiteNav extends HTMLElement {
  private events?: AbortController;
  private restoreScroll?: () => void;
  connectedCallback() {
    if (this.events) return;
    const toggle = this.querySelector<HTMLButtonElement>('[data-testid="menu-toggle"]');
    const dialog = this.querySelector<HTMLDialogElement>('dialog');
    const closeButton = this.querySelector<HTMLButtonElement>('[data-testid="menu-close"]');
    if (!toggle || !dialog || !closeButton) return;
    this.dataset.enhanced = 'true';
    this.events = new AbortController();
    const { signal } = this.events;
    const close = (restoreFocus = false) => {
      if (dialog.open) dialog.close();
      toggle.setAttribute('aria-expanded', 'false');
      this.restoreScroll?.();
      this.restoreScroll = undefined;
      if (restoreFocus && toggle.isConnected) toggle.focus({ preventScroll: true });
    };
    const open = () => {
      const body = document.body;
      const html = document.documentElement;
      const previousBody = body.style.overflow;
      const previousHtml = html.style.overflow;
      this.restoreScroll = () => {
        body.style.overflow = previousBody;
        html.style.overflow = previousHtml;
      };
      body.style.overflow = 'hidden';
      html.style.overflow = 'hidden';
      dialog.showModal();
      toggle.setAttribute('aria-expanded', 'true');
      closeButton.focus({ preventScroll: true });
    };
    toggle.addEventListener('click', () => (dialog.open ? close(true) : open()), { signal });
    closeButton.addEventListener('click', () => close(true), { signal });
    dialog.addEventListener(
      'cancel',
      (event) => {
        event.preventDefault();
        close(true);
      },
      { signal },
    );
    dialog.addEventListener(
      'click',
      (event) => {
        if (event.target instanceof Element && event.target.closest('a')) close();
      },
      { signal },
    );
    dialog.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Tab') return;
        const stops = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]',
          ),
        ).filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
        const first = stops[0];
        const last = stops.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      },
      { signal },
    );
    document.addEventListener('astro:before-preparation', () => close(), { signal });
    const desktop = matchMedia('(min-width: 768px)');
    desktop.addEventListener(
      'change',
      () => {
        if (desktop.matches && dialog.open) {
          close();
          this.querySelector<HTMLAnchorElement>('.site-name')?.focus({ preventScroll: true });
        }
      },
      { signal },
    );
  }
  disconnectedCallback() {
    this.querySelector<HTMLDialogElement>('dialog')?.close();
    this.restoreScroll?.();
    this.restoreScroll = undefined;
    this.events?.abort();
    this.events = undefined;
  }
}
if (!customElements.get('site-nav')) customElements.define('site-nav', SiteNav);

let focusAfterNavigation = false;
document.addEventListener('astro:before-preparation', () => {
  focusAfterNavigation = true;
});
document.addEventListener('astro:page-load', () => {
  if (!focusAfterNavigation) return;
  focusAfterNavigation = false;
  const heading = document.querySelector<HTMLElement>('main h1');
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
});
