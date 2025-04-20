let probChart;
let simulationTimer;

async function runSimulation(params) {
  const pyodide = await loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/"
  });
  await pyodide.loadPackage("numpy");

  await pyodide.runPythonAsync(`
    from pyodide.http import pyfetch
    response = await pyfetch("/assets/qmc.py")
    with open("qmc.py", "wb") as f:
        f.write(await response.bytes())
  `);

  await pyodide.runPythonAsync(`import qmc`);

  const pyCall = async (pVal) => {
    let result = await pyodide.runPythonAsync(
      `qmc.simulate_qmc(${params.steps}, ${params.alpha}, ${params.beta}, ${pVal})`
    );
    if (typeof result.toJs === "function") result = result.toJs();
    if (result instanceof Map) {
      const obj = {};
      for (const [key, val] of result.entries()) {
        obj[key] = (val && typeof val.toJs === "function") ? val.toJs() : val;
      }
      result = obj;
    }
    return result.probs;
  };

  const [probs0, probs1, probsCustom] = await Promise.all([
    pyCall(0.0),
    pyCall(1.0),
    pyCall(params.p)
  ]);

  const labels = Array.from({ length: probs0.length }, (_, i) => i);

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
          label: "p = 0",
          data: probs0,
          borderWidth: 2,
          fill: false,
        },
        {
          label: "p = 1",
          data: probs1,
          borderWidth: 2,
          fill: false,
        },
        {
          label: `p = ${params.p.toFixed(2)}`,
          data: probsCustom,
          borderWidth: 2,
          fill: false,
        }
      ]
    },
    options: {
      responsive: true,
      animation: {
        numbers: { duration: 0 },
        colors: {
          type: "color",
          duration: 800,
          from: "transparent"
        }
      },
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
          min: 0,
          max: 1.2
        }
      }
    }
  });
}

function scheduleSimulationUpdate() {
  clearTimeout(simulationTimer);
  simulationTimer = setTimeout(() => {
    const params = {
      p: parseFloat(document.getElementById("pInput").value),
      alpha: parseFloat(document.getElementById("alphaInput").value),
      beta: parseFloat(document.getElementById("betaInput").value),
      steps: 20
    };
    runSimulation(params);
  }, 300);
}

function setupControls() {
  const pInput = document.getElementById("pInput");
  const alphaInput = document.getElementById("alphaInput");
  const betaInput = document.getElementById("betaInput");
  const pValue = document.getElementById("pValue");
  const alphaValue = document.getElementById("alphaValue");
  const betaValue = document.getElementById("betaValue");

  pInput.addEventListener("input", function() {
    pValue.textContent = pInput.value;
    scheduleSimulationUpdate();
  });
  alphaInput.addEventListener("input", function() {
    alphaValue.textContent = alphaInput.value;
    scheduleSimulationUpdate();
  });
  betaInput.addEventListener("input", function() {
    betaValue.textContent = betaInput.value;
    scheduleSimulationUpdate();
  });
}

window.addEventListener("DOMContentLoaded", function() {
  setupControls();
  const initialParams = {
    p: parseFloat(document.getElementById("pInput").value),
    alpha: parseFloat(document.getElementById("alphaInput").value),
    beta: parseFloat(document.getElementById("betaInput").value),
    steps: 20
  };
  runSimulation(initialParams);
});
