(() => {
  const measurementId = "G-RCV7XH47PR";
  const storageKey = "heruiAnalyticsConsent";
  const blockedParameterKeys = new Set([
    "contact",
    "email",
    "phone",
    "message",
    "subject",
    "notes",
    "destination",
  ]);
  let analyticsLoaded = false;

  function readConsent() {
    try {
      return window.localStorage.getItem(storageKey);
    } catch (error) {
      return null;
    }
  }

  function writeConsent(value) {
    try {
      window.localStorage.setItem(storageKey, value);
    } catch (error) {
      console.warn("Analytics preference could not be saved.", error);
    }
  }

  function loadAnalytics() {
    if (analyticsLoaded) return;
    analyticsLoaded = true;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag() {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", measurementId, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);
  }

  function safeParameters(parameters = {}) {
    return Object.fromEntries(
      Object.entries(parameters)
        .filter(([key, value]) => !blockedParameterKeys.has(key) && ["string", "number", "boolean"].includes(typeof value))
        .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 100) : value]),
    );
  }

  function track(eventName, parameters = {}) {
    if (readConsent() !== "granted") return;
    loadAnalytics();
    window.gtag("event", eventName, safeParameters(parameters));
  }

  function updateBanner() {
    const banner = document.querySelector("#analyticsConsent");
    if (!banner) return;
    banner.hidden = readConsent() !== null;
  }

  function setConsent(value) {
    writeConsent(value);
    if (value === "granted") loadAnalytics();
    updateBanner();
  }

  window.HERUI_ANALYTICS = Object.freeze({ track });

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-analytics-consent]").forEach((button) => {
      button.addEventListener("click", () => setConsent(button.dataset.analyticsConsent));
    });
    document.querySelectorAll("[data-manage-analytics]").forEach((button) => {
      button.addEventListener("click", () => {
        try {
          window.localStorage.removeItem(storageKey);
        } catch (error) {
          console.warn("Analytics preference could not be reset.", error);
        }
        updateBanner();
      });
    });
    document.addEventListener("click", (event) => {
      const link = event.target.closest('a[href^="mailto:"], a[href^="tel:"]');
      if (!link) return;
      track("contact_click", {
        contact_method: link.href.startsWith("mailto:") ? "email" : "phone",
        link_location: link.closest("footer") ? "footer" : "page",
      });
    });

    if (readConsent() === "granted") loadAnalytics();
    updateBanner();
  });
})();
