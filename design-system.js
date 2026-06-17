/* ============================================================
 * HARTH DESIGN SYSTEM — runtime helpers
 * ------------------------------------------------------------
 * Exposes a single global namespace `window.harth` with:
 *   - toast(msg, opts)        → push a toast onto the stack
 *   - skeleton.cards(n)       → HTML string for n card skeletons
 *   - skeleton.rows(n)        → HTML string for n row skeletons
 *   - skeleton.tableRows(n,c) → HTML string for n table-row skeletons
 *   - empty(opts)             → HTML string for an illustrated empty state
 *   - error(opts)             → HTML string for an illustrated error state
 *
 * Pure helpers — they return HTML strings or DOM nodes; the page
 * decides where to put them. No globals are created beyond `harth`.
 * ============================================================ */
(function () {
  "use strict";

  // ------------------------------------------------------------
  // Toast
  // ------------------------------------------------------------
  function ensureStack() {
    let stack = document.querySelector(".hs-toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "hs-toast-stack";
      stack.setAttribute("role", "status");
      stack.setAttribute("aria-live", "polite");
      document.body.appendChild(stack);
    }
    return stack;
  }

  /**
   * Show a toast.
   * @param {string} msg
   * @param {{ kind?: 'success'|'error'|'warning'|'info', duration?: number, icon?: string }} [opts]
   */
  function toast(msg, opts = {}) {
    const { kind = "success", duration = 3000, icon } = opts;
    const stack = ensureStack();
    const el = document.createElement("div");
    el.className = `hs-toast hs-toast--${kind}`;
    const iconHtml = icon
      ? `<i class="${icon}"></i>`
      : ({
          success: '<i class="fas fa-check-circle"></i>',
          error:   '<i class="fas fa-exclamation-circle"></i>',
          warning: '<i class="fas fa-exclamation-triangle"></i>',
          info:    '<i class="fas fa-info-circle"></i>',
        }[kind] || "");
    el.innerHTML = `${iconHtml}<span></span>`;
    el.querySelector("span").textContent = msg;
    stack.appendChild(el);

    setTimeout(() => {
      el.classList.add("is-leaving");
      el.addEventListener("animationend", () => el.remove(), { once: true });
    }, duration);
  }

  // ------------------------------------------------------------
  // Skeletons (return HTML strings the caller can innerHTML)
  // ------------------------------------------------------------
  function skelCard() {
    return `
      <div class="hs-skel-card">
        <div class="hs-skel hs-skel--thumb"></div>
        <div class="hs-skel-card__body">
          <div class="hs-skel hs-skel--title"></div>
          <div class="hs-skel hs-skel--line"></div>
          <div class="hs-skel hs-skel--line" style="width:70%"></div>
          <div style="display:flex;gap:8px;margin-top:6px">
            <div class="hs-skel hs-skel--btn"></div>
            <div class="hs-skel hs-skel--btn" style="width:60px"></div>
          </div>
        </div>
      </div>`;
  }
  function skelCards(n = 6) {
    let html = '<div class="hs-skel-grid">';
    for (let i = 0; i < n; i++) html += skelCard();
    return html + "</div>";
  }
  function skelRow() {
    return `
      <div class="hs-skel-row">
        <div class="hs-skel hs-skel--title"></div>
        <div class="hs-skel hs-skel--line"></div>
        <div class="hs-skel hs-skel--line" style="width:50%"></div>
      </div>`;
  }
  function skelRows(n = 4) {
    let html = "";
    for (let i = 0; i < n; i++) html += skelRow();
    return html;
  }
  function skelTableRow(cols = 5) {
    let cells = '<div class="hs-skel hs-skel--avatar" style="height:40px;width:40px"></div>';
    for (let i = 1; i < cols; i++) cells += '<div class="hs-skel hs-skel--text"></div>';
    return `<div class="hs-skel-table-row">${cells}</div>`;
  }
  function skelTableRows(n = 5, cols = 5) {
    let html = "";
    for (let i = 0; i < n; i++) html += skelTableRow(cols);
    return html;
  }

  // ------------------------------------------------------------
  // Empty / Error state
  // ------------------------------------------------------------
  // A small library of inline SVG illustrations. Keeping them
  // inline avoids a network request and lets us recolor via
  // currentColor.
  const ART = {
    crops: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M32 56V28"/><path d="M32 32c-6 0-10-4-10-10 6 0 10 4 10 10z"/><path d="M32 30c6 0 10-4 10-10-6 0-10 4-10 10z"/><path d="M14 56h36"/><path d="M22 56l4-8"/><path d="M42 56l-4-8"/></svg>`,
    box:   `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 18l24-10 24 10v28L32 56 8 46V18z"/><path d="M8 18l24 10 24-10"/><path d="M32 28v28"/></svg>`,
    cart:  `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 10h8l6 30h28l6-22H18"/><circle cx="22" cy="50" r="4"/><circle cx="44" cy="50" r="4"/></svg>`,
    truck: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h32v28H4z"/><path d="M36 22h14l8 10v10H36"/><circle cx="16" cy="46" r="4"/><circle cx="46" cy="46" r="4"/></svg>`,
    users: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="22" r="8"/><path d="M8 50c2-8 9-12 16-12s14 4 16 12"/><circle cx="46" cy="20" r="6"/><path d="M40 36c8 0 14 4 16 12"/></svg>`,
    search:`<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="28" cy="28" r="14"/><path d="M40 40l14 14"/></svg>`,
    file:  `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 6h26l12 12v40H14z"/><path d="M40 6v12h12"/><path d="M22 32h20M22 40h20M22 48h12"/></svg>`,
    bell:  `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M16 28a16 16 0 0 1 32 0v12l4 8H12l4-8V28z"/><path d="M28 52a4 4 0 0 0 8 0"/></svg>`,
    error: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="32" r="24"/><path d="M22 22l20 20M42 22L22 42"/></svg>`,
    check: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="32" r="24"/><path d="M22 32l8 8 14-16"/></svg>`,
  };

  /**
   * Build an HTML string for an illustrated empty state.
   * @param {{
   *   art?: keyof typeof ART,
   *   title: string,
   *   description?: string,
   *   action?: { label: string, href?: string, onClick?: string, variant?: string },
   *   variant?: 'default' | 'error'
   * }} opts
   */
  function empty(opts = {}) {
    const {
      art = "crops",
      title = "لا يوجد محتوى",
      description = "",
      action,
      variant = "default",
    } = opts;
    const svg = ART[art] || ART.crops;
    const cta = action
      ? `<div class="hs-empty__cta">${
          action.href
            ? `<a class="hs-btn hs-btn--${action.variant || "secondary"}" href="${action.href}">${escapeText(action.label)}</a>`
            : `<button class="hs-btn hs-btn--${action.variant || "secondary"}" onclick="${action.onClick || ""}">${escapeText(action.label)}</button>`
        }</div>`
      : "";
    return `
      <div class="hs-empty${variant === "error" ? " hs-empty--error" : ""}">
        <div class="hs-empty__art">${svg}</div>
        <h3 class="hs-empty__title">${escapeText(title)}</h3>
        ${description ? `<p class="hs-empty__desc">${escapeText(description)}</p>` : ""}
        ${cta}
      </div>`;
  }

  /** Convenience wrapper for error states. */
  function errorState(opts = {}) {
    return empty({
      art: "error",
      variant: "error",
      title: opts.title || "حدث خطأ",
      description: opts.description || opts.message || "حاول مرة أخرى بعد قليل.",
      action: opts.action,
    });
  }

  function escapeText(s) {
    if (s == null) return "";
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]),
    );
  }

  // ------------------------------------------------------------
  // Public namespace
  // ------------------------------------------------------------
  window.harth = {
    toast,
    skeleton: {
      card: skelCard,
      cards: skelCards,
      row: skelRow,
      rows: skelRows,
      tableRow: skelTableRow,
      tableRows: skelTableRows,
    },
    empty,
    error: errorState,
    art: ART,
  };
})();
