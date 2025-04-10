// Global variables for the charts and pause flag.
let probChart, coherenceChart;
let simulationTimer; // for debouncing
let paused = false;  // simulation running by default

async function runSimulation(params) {
  console.log("Running simulation with params:", params);

  // Load Pyodide
  const pyodide = await loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/"
  });
  await pyodide.loadPackage("numpy");

  // Load qmc.py into Pyodide's virtual filesystem
  try {
    await pyodide.runPythonAsync(`
      from pyodide.http import pyfetch
      response = await pyfetch("/assets/qmc.py")
      with open("qmc.py", "wb") as f:
          f.write(await response.bytes())
    `);
  } catch (error) {
    console.error("Error loading qmc.py:", error);
    return;
  }

  try {
    await pyodide.runPythonAsync(`import qmc`);
    // Run simulation with parameters (steps fixed at 50 for now)
    let result = await pyodide.runPythonAsync(
      `qmc.simulate_qmc(50, ${params.lam1}, ${params.lam2}, ${params.p})`
    );

    // Convert Pyodide object to a JS object
    if (typeof result.toJs === "function") {
      result = result.toJs();
    }
    if (result instanceof Map) {
      const obj = {};
      for (const [key, val] of result.entries()) {
        obj[key] = (val && typeof val.toJs === "function") ? val.toJs() : val;
      }
      result = obj;
    }
    console.log("Final JS result:", result);

    const { probs, coherences } = result;
    const labels = Array.from({ length: 50 }, (_, i) => i + 1);

    // Render probability chart
    const probCanvas = document.getElementById("qmcChartProb");
    const probCtx = probCanvas.getContext("2d");
    if (probChart) {
      probChart.destroy();
    }
    probChart = new Chart(probCtx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Site 1 Probability",
            data: probs.map(p => p[0]),
            borderWidth: 2,
            fill: false,
          },
          {
            label: "Site 2 Probability",
            data: probs.map(p => p[1]),
            borderWidth: 2,
            fill: false,
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
          }
        }
      }
    });
    console.log("Probability chart rendered");

    // Render coherence chart
    const coherenceCanvas = document.getElementById("qmcChartCoherence");
    const coherenceCtx = coherenceCanvas.getContext("2d");
    if (coherenceChart) {
      coherenceChart.destroy();
    }
    coherenceChart = new Chart(coherenceCtx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Site 1 Coherence",
            data: coherences.map(c => c[0]),
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false,
          },
          {
            label: "Site 2 Coherence",
            data: coherences.map(c => c[1]),
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false,
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
          }
        }
      }
    });
    console.log("Coherence chart rendered");
  } catch (error) {
    console.error("Error during simulation:", error);
  }
}

function scheduleSimulationUpdate() {
  // Only run simulation if not paused.
  if (paused) {
    console.log("Simulation is paused; skipping update.");
    return;
  }
  clearTimeout(simulationTimer);
  // Run simulation after a 300ms debounce delay
  simulationTimer = setTimeout(() => {
    const params = {
      p: parseFloat(document.getElementById("pInput").value),
      lam1: parseFloat(document.getElementById("lam1Input").value),
      lam2: parseFloat(document.getElementById("lam2Input").value),
      steps: 50
    };
    runSimulation(params);
  }, 300);
}

function setupControls() {
  const pInput = document.getElementById("pInput");
  const lam1Input = document.getElementById("lam1Input");
  const lam2Input = document.getElementById("lam2Input");
  const pValue = document.getElementById("pValue");
  const lam1Value = document.getElementById("lam1Value");
  const lam2Value = document.getElementById("lam2Value");
  const toggleBtn = document.getElementById("toggleSimulation");

  // Update slider displays and schedule simulation updates.
  pInput.addEventListener("input", function() {
    pValue.textContent = pInput.value;
    scheduleSimulationUpdate();
  });
  lam1Input.addEventListener("input", function() {
    lam1Value.textContent = lam1Input.value;
    scheduleSimulationUpdate();
  });
  lam2Input.addEventListener("input", function() {
    lam2Value.textContent = lam2Input.value;
    scheduleSimulationUpdate();
  });

  // Toggle pause/resume when the button is clicked.
  toggleBtn.addEventListener("click", function() {
    paused = !paused;
    if (paused) {
      toggleBtn.textContent = "Resume Simulation";
      console.log("Simulation paused.");
    } else {
      toggleBtn.textContent = "Pause Simulation";
      console.log("Simulation resumed.");
      scheduleSimulationUpdate(); // run simulation when unpausing
    }
  });
}

// Initialize on DOM load
window.addEventListener("DOMContentLoaded", function() {
  setupControls();
  const initialParams = {
    p: parseFloat(document.getElementById("pInput").value),
    lam1: parseFloat(document.getElementById("lam1Input").value),
    lam2: parseFloat(document.getElementById("lam2Input").value),
    steps: 50
  };
  runSimulation(initialParams);
});
