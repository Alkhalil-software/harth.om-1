/**
 * unified-nav.js — Harth Platform
 * Injects a consistent, role-aware navigation into every page.
 *
 * What it does:
 *   1. Replaces <ul class="nav-links"> content with the canonical item list.
 *   2. Adds a mobile bottom-nav bar fixed at the bottom (≤768 px).
 *   3. Marks the current page as "active".
 *   4. Does NOT touch auth sections — each page's own JS handles login/logout state.
 *
 * Pages that are explicitly skipped (they manage their own nav):
 *   admin-dashboard.html, register.html, forgot-password.html, checkout.html
 */
(function () {
  "use strict";

  /* ─── Pages to skip entirely ────────────────────────────────────── */
  const SKIP = [
    "admin-dashboard.html",
    "register.html",
    "forgot-password.html",
    "checkout.html",
  ];

  /* ─── Canonical desktop nav items ───────────────────────────────── */
  // roles: "*"   → shown to everyone (including guests)
  // roles: [..] → shown only when logged-in user's role is in the array
  const NAV_ITEMS = [
    {
      href:  "index.html",
      label: "الرئيسية",
      icon:  "fa-home",
      roles: "*",
    },
    {
      href:  "tools.html",
      label: "تأجير معدات",
      icon:  "fa-tractor",
      roles: "*",
    },
    {
      href:  "basket.html",
      label: "بيع معدات",
      icon:  "fa-store",
      roles: "*",
    },
    {
      href:  "owner-dashboard.html",
      label: "لوحة المالك",
      icon:  "fa-tachometer-alt",
      roles: ["owner", "admin"],
    },
    {
      href:  "my-orders.html",
      label: "طلباتي",
      icon:  "fa-box",
      roles: ["renter", "owner", "admin"],
    },
    {
      href:  "delivery.html",
      label: "التوصيل",
      icon:  "fa-truck",
      roles: ["delivery", "admin"],
    },
    {
      href:  "track.html",
      label: "تتبع الطلبات",
      icon:  "fa-map-marker-alt",
      roles: ["renter", "owner", "delivery"],
    },
    {
      href:  "loyalty.html",
      label: "برنامج الولاء",
      icon:  "fa-medal",
      roles: ["renter", "owner"],
    },
    {
      href:  "support.html",
      label: "الدعم الفني",
      icon:  "fa-headset",
      roles: "*",
    },
  ];

  /* ─── Mobile bottom-nav items (max 5 per role) ───────────────────── */
  const MOBILE_ITEMS = [
    { href: "index.html",           label: "الرئيسية", icon: "fa-home",           roles: "*"                               },
    { href: "tools.html",           label: "تأجير",    icon: "fa-tractor",        roles: "*"                               },
    { href: "basket.html",          label: "بيع",      icon: "fa-store",          roles: "*"                               },
    { href: "my-orders.html",       label: "طلباتي",   icon: "fa-box",            roles: ["renter", "owner", "admin"]      },
    { href: "delivery.html",        label: "توصيل",    icon: "fa-truck",          roles: ["delivery"]                      },
    { href: "owner-dashboard.html", label: "لوحتي",    icon: "fa-th-large",       roles: ["owner", "admin"]                },
    { href: "track.html",           label: "تتبع",     icon: "fa-map-marker-alt", roles: ["renter", "owner", "delivery"]   },
    { href: "loyalty.html",         label: "الولاء",   icon: "fa-medal",          roles: ["renter", "owner"]               },
    { href: "support.html",         label: "الدعم",    icon: "fa-headset",        roles: "*"                               },
  ];

  /* ─── Helpers ────────────────────────────────────────────────────── */
  function getUser() {
    try { return JSON.parse(localStorage.getItem("user") || "null"); }
    catch { return null; }
  }

  function currentPage() {
    return window.location.pathname.split("/").pop() || "index.html";
  }

  function allowed(item, role) {
    if (item.roles === "*") return true;
    if (!role) return false;
    return item.roles.includes(role);
  }

  function isActive(href) {
    return currentPage() === href;
  }

  /* ─── CSS injection ──────────────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById("un-nav-css")) return;
    const s = document.createElement("style");
    s.id = "un-nav-css";
    s.textContent = `
      /* ── Active state for desktop nav items ─────────────── */
      .nav-links .nav-item.active,
      .nav-links a.active {
        color: #6ab04c !important;
        font-weight: 700;
        position: relative;
      }
      .nav-links .nav-item.active::after,
      .nav-links a.active::after {
        content: "";
        display: block;
        position: absolute;
        bottom: -4px;
        inset-inline-start: 0;
        inset-inline-end: 0;
        height: 2px;
        background: #6ab04c;
        border-radius: 2px;
      }

      /* ── Mobile bottom nav ──────────────────────────────── */
      #un-mobile-nav {
        display: none;
      }

      @media (max-width: 768px) {
        #un-mobile-nav {
          display: flex;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: #142d0a;
          border-top: 1px solid rgba(106, 176, 76, 0.25);
          z-index: 9000;
          padding: 6px 0 calc(6px + env(safe-area-inset-bottom, 0px));
          justify-content: space-around;
          align-items: flex-end;
          box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.35);
        }

        /* Push page content above mobile nav */
        body {
          padding-bottom: max(72px, calc(56px + env(safe-area-inset-bottom, 0px))) !important;
        }
      }

      /* ── Mobile nav items ────────────────────────────────── */
      .un-mob {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        color: rgba(255, 255, 255, 0.45);
        text-decoration: none;
        font-size: 10px;
        font-family: 'Cairo', sans-serif;
        padding: 5px 8px 3px;
        border-radius: 12px;
        transition: color 0.18s ease, background 0.18s ease;
        min-width: 52px;
        text-align: center;
        -webkit-tap-highlight-color: transparent;
      }
      .un-mob i {
        font-size: 22px;
        display: block;
        line-height: 1;
        margin-bottom: 1px;
      }
      .un-mob.active {
        color: #6ab04c;
      }
      .un-mob.active i {
        filter: drop-shadow(0 0 6px rgba(106, 176, 76, 0.5));
      }
      .un-mob:active {
        background: rgba(106, 176, 76, 0.14);
        color: #fff;
        transform: scale(0.93);
      }
    `;
    document.head.appendChild(s);
  }

  /* ─── Desktop nav update ─────────────────────────────────────────── */
  function updateDesktopNav(user) {
    const ul = document.querySelector("ul.nav-links");
    if (!ul) return;

    const role = user?.role || null;
    ul.innerHTML = NAV_ITEMS
      .filter(i => allowed(i, role))
      .map(i => `<li><a href="${i.href}" class="nav-item${isActive(i.href) ? " active" : ""}">
          <i class="fas ${i.icon}"></i> ${i.label}
        </a></li>`)
      .join("");
  }

  /* ─── Mobile bottom nav ──────────────────────────────────────────── */
  function updateMobileNav(user) {
    let mob = document.getElementById("un-mobile-nav");
    if (!mob) {
      mob = document.createElement("nav");
      mob.id = "un-mobile-nav";
      mob.setAttribute("aria-label", "التنقل السريع");
      document.body.appendChild(mob);
    }

    const role = user?.role || null;
    mob.innerHTML = MOBILE_ITEMS
      .filter(i => allowed(i, role))
      .slice(0, 5)
      .map(i => `<a href="${i.href}" class="un-mob${isActive(i.href) ? " active" : ""}">
          <i class="fas ${i.icon}"></i>
          <span>${i.label}</span>
        </a>`)
      .join("");
  }

  /* ─── Entry point ────────────────────────────────────────────────── */
  function run() {
    const page = currentPage();
    if (SKIP.includes(page)) return;

    injectCSS();

    const user = getUser();
    updateDesktopNav(user);
    updateMobileNav(user);
  }

  // Run after DOM is ready (works whether script is defer or at body end)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
