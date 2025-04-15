let gapChart;
let simulationTimer;
let paused = false;

async function runSpectralGapSimulation(params) {
  console.log("[INFO] Initialising Pyodide...");

  const pyodide = await loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/"
  });

  await pyodide.loadPackage("numpy");

  try {
    await pyodide.runPythonAsync(`
      from pyodide.http import pyfetch
      response = await pyfetch("/assets/spectralgap.py")
      with open("spectralgap.py", "wb") as f:
          f.write(await response.bytes())
    `);
  } catch (error) {
    console.error("[ERROR] Failed to load spectralgap.py:", error);
    return;
  }

  try {
    await pyodide.runPythonAsync("import spectralgap");
    console.log("[INFO] Running spectralgap.simulate...");

    let result = await pyodide.runPythonAsync(
      `spectralgap.simulate(${params.lam1}, ${params.lam2})`
    );

    console.log("[INFO] Result:", result);

    if (typeof result.toJs === "function") {
      result = result.toJs();
    }

    if (result instanceof Map) {
      const converted = {};
      for (const [key, val] of result.entries()) {
        converted[key] = (val && typeof val.toJs === "function") ? val.toJs() : val;
      }
      result = converted;
    }

    const labels = Array.from({ length: 21 }, (_, i) => i / 20);
    const canvas = document.getElementById("sgChart");
    if (!canvas) {
      console.error("[ERROR] sgChart canvas element not found in DOM.");
      return;
    }

    const ctx = canvas.getContext("2d");

    if (gapChart) {
        gapChart.destroy();
      }

    gapChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Spectral Gap",
            data: result.gaps,
            borderWidth: 2,
            fill: false,
            borderColor: "rgba(0, 123, 255, 1)",
            pointRadius: 1
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
            x: {
                title: {
                  display: true,
                  text: "Dephasing rate"
                }
              },
              y: {
                beginAtZero: true,
                max: 1,
                title: {
                  display: true,
                  text: "Spectral gap"
                }
              }
        },
        plugins: {
            legend: {
              display: false
            }
          },
      }
    });

    console.log("[INFO] Chart rendered.");
  } catch (error) {
    console.error("[ERROR] Simulation error:", error);
  }
}

function scheduleSpectralGapUpdate() {
  if (paused) {
    console.log("[INFO] Simulation paused. Skipping update.");
    return;
  }

  clearTimeout(simulationTimer);
  simulationTimer = setTimeout(() => {
    const params = {
      lam1: parseFloat(document.getElementById("lam1Input").value),
      lam2: parseFloat(document.getElementById("lam2Input").value)
    };
    console.log("[INFO] Scheduling simulation update with params:", params);
    runSpectralGapSimulation(params);
  }, 300);
}

function setupSpectralGapControls() {
  const lam1Input = document.getElementById("lam1Input");
  const lam2Input = document.getElementById("lam2Input");
  const lam1Value = document.getElementById("lam1Value");
  const lam2Value = document.getElementById("lam2Value");
  const toggleBtn = document.getElementById("toggleSimulation");

  lam1Input.addEventListener("input", function () {
    lam1Value.textContent = lam1Input.value;
    scheduleSpectralGapUpdate();
  });

  lam2Input.addEventListener("input", function () {
    lam2Value.textContent = lam2Input.value;
    scheduleSpectralGapUpdate();
  });

  toggleBtn.addEventListener("click", function () {
    paused = !paused;
    toggleBtn.textContent = paused ? "Resume Simulation" : "Pause Simulation";
    if (!paused) scheduleSpectralGapUpdate();
  });
}

window.addEventListener("DOMContentLoaded", function () {
  console.log("[INFO] DOM loaded, setting up controls...");
  setupSpectralGapControls();
  const params = {
    lam1: parseFloat(document.getElementById("lam1Input").value),
    lam2: parseFloat(document.getElementById("lam2Input").value)
  };
  console.log("[INFO] Running initial simulation with params:", params);
  runSpectralGapSimulation(params);
});
