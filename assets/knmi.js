(() => {
  console.log("knmi.js loaded");

  const KONAMI = [
    "ArrowUp","ArrowUp","ArrowDown","ArrowDown",
    "ArrowLeft","ArrowRight","ArrowLeft","ArrowRight",
    "b","a"
  ];

  let index = 0;
  let lastKeyTime = 0;
  const TIMEOUT = 2500;

  function reset() { index = 0; }

  function showKonamiOverlay() {
    const REDIRECT_TO = "/lost";
    const IMG_SRC = "/assets/groth.jpg";

    const is404 = !!document.querySelector('meta[name="page-kind"][content="404"]');

    // Prevent double-trigger
    if (document.getElementById("konami-overlay")) return;

    // Inject CSS once
    if (!document.getElementById("konami-style")) {
      const style = document.createElement("style");
      style.id = "konami-style";
      style.textContent = `
        @keyframes konamiPop {
          0%   { transform: translate(-50%, -50%) scale(0.05) rotate(-12deg); filter: blur(6px); opacity: 0; }
          25%  { transform: translate(-50%, -50%) scale(1.2) rotate(6deg);  filter: blur(0);  opacity: 1; }
          60%  { transform: translate(-50%, -50%) scale(7) rotate(-4deg); }
          100% { transform: translate(-50%, -50%) scale(14) rotate(2deg); }
        }
        @keyframes konamiWobble {
          0%,100% { transform: translate(-50%, -50%) scale(14) rotate(2deg); }
          25%     { transform: translate(-50%, -50%) scale(14) rotate(-6deg); }
          50%     { transform: translate(-50%, -50%) scale(14) rotate(6deg); }
          75%     { transform: translate(-50%, -50%) scale(14) rotate(-3deg); }
        }

        #konami-overlay {
          position: fixed;
          inset: 0;
          z-index: 999999;
          background: rgba(0,0,0,0.75);
          backdrop-filter: blur(3px);
        }

        #konami-overlay img {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%) scale(0.05);
          max-width: min(70vw, 520px);
          max-height: 70vh;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.6);
          animation: konamiPop 1.1s ease-in forwards, konamiWobble 0.35s ease-in-out 1.1s 2;
          image-rendering: auto;
        }

        /* Center the emoji/text more aggressively */
        #konami-overlay .konami-text {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: min(92vw, 900px);
          color: white;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
          letter-spacing: 0.04em;
          text-align: center;
          text-shadow: 0 6px 30px rgba(0,0,0,0.8);
          opacity: 0.98;
          user-select: none;
          pointer-events: none; /* clicks go to overlay */
        }

        /* When showing only text (on 404), keep it readable */
        #konami-overlay.konami-textonly .konami-text {
          font-size: 28px;
          font-weight: 800;
        }
      `;
      document.head.appendChild(style);
    }

    // Build overlay
    const overlay = document.createElement("div");
    overlay.id = "konami-overlay";
    if (is404) overlay.classList.add("konami-textonly");

    const text = document.createElement("div");
    text.className = "konami-text";

    if (is404) {
      // On 404: just show the line and stay put (no redirect)
      text.textContent = "You're already lost? 🧐";
    } else {
      const img = document.createElement("img");
      img.src = IMG_SRC;
      img.alt = "Konami unlocked";
      overlay.appendChild(img);

      text.innerHTML = `<div style="font-size:200px; line-height:1; transform: translateY(-10px);">😎😵🧙</div>`;
    }

    overlay.appendChild(text);

    // Prevent scroll while overlay is up
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    // Click behavior:
    // - if not 404: click skips to redirect
    // - if 404: click just removes overlay and restores scroll
    overlay.addEventListener("click", () => {
      document.documentElement.style.overflow = prevOverflow;
      overlay.remove();
      if (!is404) window.location.href = REDIRECT_TO;
    });

    document.body.appendChild(overlay);

    // Auto-advance only if not already on 404
    if (!is404) {
      setTimeout(() => {
        document.documentElement.style.overflow = prevOverflow;
        window.location.href = REDIRECT_TO;
      }, 1400);
    } else {
  setTimeout(() => {
    document.documentElement.style.overflow = prevOverflow;
    overlay.remove();
  }, 2000);
}
  }

  function onKeyDown(e) {
    const el = document.activeElement;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;

    const now = Date.now();
    if (lastKeyTime && now - lastKeyTime > TIMEOUT) reset();
    lastKeyTime = now;

    const key = (e.key && e.key.length === 1) ? e.key.toLowerCase() : e.key;

    if (key === KONAMI[index]) {
      index++;
      if (index === KONAMI.length) {
        reset();
        showKonamiOverlay();
      }
    } else {
      index = (key === KONAMI[0]) ? 1 : 0;
    }
  }

  window.addEventListener("keydown", onKeyDown, { capture: true });
})();
