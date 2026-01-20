(function () {
  const prefersReducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const rand = (min, max) => Math.floor(min + Math.random() * (max - min + 1));

  function typeText(el) {
    const full = (el.textContent || "");
    if (!full.trim()) return;

    el.classList.add("typewriter");

    // Respect reduced motion: no typing animation
    if (prefersReducedMotion) return;

    el.textContent = "";
    let i = 0;

    const settings = {
      startDelay: 250,

      // "Normal" typing speed range (ms per character)
      charDelayMin: 25,
      charDelayMax: 75,

      // Extra pauses after punctuation (adds on top of normal speed)
      pauseAfter: {
        ".": [350, 850],
        "!": [400, 900],
        "?": [400, 900],
        ",": [120, 320],
        ";": [200, 500],
        ":": [200, 500],
        "\n": [600, 1200],
      },

      // Optional: tiny pause on spaces (feels more human)
      spacePause: [5, 30],
    };

    function nextDelay(prevChar) {
      let delay = rand(settings.charDelayMin, settings.charDelayMax);

      // small space hesitation
      if (prevChar === " ") {
        delay += rand(settings.spacePause[0], settings.spacePause[1]);
      }

      // punctuation pauses
      if (settings.pauseAfter[prevChar]) {
        const [minExtra, maxExtra] = settings.pauseAfter[prevChar];
        delay += rand(minExtra, maxExtra);
      }

      return delay;
    }

    const tick = () => {
      el.textContent = full.slice(0, i);
      const prevChar = full[i - 1] || "";
      i++;

      if (i <= full.length) {
        setTimeout(tick, nextDelay(prevChar));
      }
    };

    setTimeout(tick, settings.startDelay);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const subtitle = document.querySelector(".profile .profile_inner > span");
    if (!subtitle) return;

    typeText(subtitle);
  });
})();
