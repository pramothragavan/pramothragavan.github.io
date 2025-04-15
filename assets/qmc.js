let probChart, coherenceChart;
let simulationTimer;
let paused = false;

async function runSimulation(params) {
  console.log("Running simulation with params:", params);

  const pyodide = await loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/"
  });
  await pyodide.loadPackage("numpy");

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
    let result = await pyodide.runPythonAsync(
      `qmc.simulate_qmc(50, ${params.lam1}, ${params.lam2}, ${params.p})`
    );

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
            label: "Site 1",
            data: probs.map(p => p[0]),
            borderWidth: 2,
            fill: false,
          },
          {
            label: "Site 2",
            data: probs.map(p => p[1]),
            borderWidth: 2,
            fill: false,
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          x: {
            title: {
              display: true,
              text: "Time Steps"
            }
          },
          y: {
            title: {
              display: true,
              text: "Probability"
            },
            beginAtZero: true,
          }
        }
      }
    });
    console.log("Probability chart rendered");

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
            label: "Site 1",
            data: coherences.map(c => c[0]),
            borderWidth: 2,
            fill: false,
          },
          {
            label: "Site 2",
            data: coherences.map(c => c[1]),
            borderWidth: 2,
            fill: false,
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          x : {title: {
            display: true,
            text: "Time Steps"
          }},
          y: {
            title: {
              display: true,
              text: "Coherence"
            },
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
  if (paused) {
    console.log("Simulation is paused; skipping update");
    return;
  }
  clearTimeout(simulationTimer);
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

  toggleBtn.addEventListener("click", function() {
    paused = !paused;
    if (paused) {
      toggleBtn.textContent = "Resume Simulation";
      console.log("Simulation paused");
    } else {
      toggleBtn.textContent = "Pause Simulation";
      console.log("Simulation resumed");
      scheduleSimulationUpdate();
    }
  });
}

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
