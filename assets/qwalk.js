let walkChart;
let pyodide = null;
let qwalkReady = false;
let simulationTimer;

async function initQWalk() {
  if (pyodide && qwalkReady) return;

  pyodide = await loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/"
  });

  await pyodide.loadPackage(["numpy", "scipy"]);

  await pyodide.runPythonAsync(`
    from pyodide.http import pyfetch
    response = await pyfetch("/assets/qwalk.py")
    with open("qwalk.py", "wb") as f:
        f.write(await response.bytes())
  `);

  await pyodide.runPythonAsync(`import qwalk`);
  qwalkReady = true;
}

async function runQWalk(params) {
  await initQWalk();
  if (!qwalkReady) return;

  let result = await pyodide.runPythonAsync(
    `qwalk.simulate_qwalk(p=${params.p}, theta0=${params.theta0}, theta1=${params.theta1})`
  );

  if (typeof result.toJs === "function") result = result.toJs();

  if (result instanceof Map) {
    const obj = {};
    for (const [key, val] of result.entries()) {
      obj[key] = (val && typeof val.toJs === "function") ? val.toJs() : val;
    }
    result = obj;
  }

  const labels = result.position;
  const data = result.final_probs;

  const ctx = document.getElementById("qwalkChart")?.getContext("2d");
  if (!ctx) return;

  if (walkChart) walkChart.destroy();
  walkChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: "Probability",
        data: data,
        borderWidth: 2,
        fill: false,
        legend: false,
      }]
    },
    options: {
      responsive: true,
      scales: {
        x: { title: { display: true, text: "Position" } },
        y: {
          title: { display: true, text: "Probability" },
          beginAtZero: true
        }
        },
    plugins: {
        legend: {
          display: false
        }
      },
    }
  });
}

function setupQWalkControls() {
  const update = () => {

    const p = parseFloat(document.getElementById("pInput").value);
    const theta0 = parseFloat(document.getElementById("theta0Input").value);
    const theta1 = parseFloat(document.getElementById("theta1Input").value);
    runQWalk({ p, theta0, theta1 });
  };

  const scheduleUpdate = () => {
    clearTimeout(simulationTimer);
    simulationTimer = setTimeout(update, 300);
  };

  ["pInput", "theta0Input", "theta1Input"].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener("input", () => {
      document.getElementById(id + "Val").textContent = el.value;
      scheduleUpdate();
    });
  });

  update();
}

window.addEventListener("DOMContentLoaded", () => {
  setupQWalkControls();
});
