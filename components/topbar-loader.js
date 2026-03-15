(function () {
  const container = document.getElementById("topbar-slot");
  if (!container) return;

  const host = window.location.hostname.toLowerCase();
  const path = window.location.pathname.toLowerCase();

  const mode = (container.dataset.topbar || "").toLowerCase();
  const isPlatform = mode === "platform";
  const isUniverse = mode === "universe";

  const primaryBase = "https://satoshium.link/components";
  const fallbackBase = "https://satoshiumai.github.io/satoshium-link/components";

  const fileName = isUniverse ? "topbar-universe.html" : "topbar-ai.html";

  function hostIs() {
    return Array.from(arguments).includes(host);
  }

  function pathStarts(prefix) {
    return path === prefix || path.startsWith(prefix);
  }

  function setActive(key) {
    const el = container.querySelector(`.topbar .nav a[data-nav="${key}"]`);
    if (el) el.classList.add("active");
  }

  function applyActiveState() {
    if (isPlatform) {
      if (path === "/" || path === "/index.html") {
        setActive("home");
      } else if (pathStarts("/start-here/")) {
        setActive("start-here");
      } else if (pathStarts("/architecture/")) {
        setActive("architecture");
      } else if (pathStarts("/systems/")) {
        setActive("systems");
      } else if (pathStarts("/services/")) {
        setActive("services");
      } else if (pathStarts("/education/")) {
        setActive("education");
      } else if (pathStarts("/labs/")) {
        setActive("labs");
      } else if (pathStarts("/build/")) {
        setActive("build");
      } else if (pathStarts("/updates/")) {
        setActive("updates");
      } else if (pathStarts("/repo-map/") || pathStarts("/repos/")) {
        setActive("repomap");
      } else if (pathStarts("/registry/")) {
        setActive("registry");
      } else {
        setActive("home");
      }
      return;
    }

    // ===== Universe topbar =====

    if (
      hostIs("satoshiumai.github.io") &&
      (path === "/satoshium-progress/" ||
        path === "/satoshium-progress" ||
        path.startsWith("/satoshium-progress/"))
    ) {
      setActive("progress");
      return;
    }

    if (
      hostIs("satoshium.link", "www.satoshium.link") &&
      pathStarts("/progress/")
    ) {
      setActive("progress");
      return;
    }

    if (hostIs("satoshium.link", "www.satoshium.link")) {
      setActive("link");
      return;
    }

    if (hostIs("satoshium.dev", "www.satoshium.dev")) {
      setActive("dev");
      return;
    }

    if (hostIs("satoshium.xyz", "www.satoshium.xyz")) {
      setActive("xyz");
      return;
    }

    if (hostIs("satoshium.info", "www.satoshium.info")) {
      if (pathStarts("/workspace/")) {
        setActive("workspace");
      } else {
        setActive("info");
      }
      return;
    }

    if (hostIs("satoshium.net", "www.satoshium.net")) {
      setActive("net");
      return;
    }

    if (hostIs("satoshium.store", "www.satoshium.store")) {
      setActive("store");
      return;
    }

    if (hostIs("satoshium.us", "www.satoshium.us")) {
      setActive("us");
      return;
    }

    if (hostIs("satoshium.ai", "www.satoshium.ai")) {
      setActive("main-site");
      return;
    }

    setActive("link");
  }

  async function tryFetch(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load topbar: " + response.status + " @ " + url);
    }
    return response.text();
  }

  async function loadTopbar() {
    const primaryUrl = `${primaryBase}/${fileName}`;
    const fallbackUrl = `${fallbackBase}/${fileName}`;

    try {
      container.innerHTML = await tryFetch(primaryUrl);
      applyActiveState();
      return;
    } catch (err) {
      console.warn("Primary topbar failed, trying GitHub fallback.", err);
    }

    try {
      container.innerHTML = await tryFetch(fallbackUrl);
      applyActiveState();
      return;
    } catch (err) {
      console.error("Topbar load error. Primary and fallback both failed.", err);
    }
  }

  loadTopbar();
})();
