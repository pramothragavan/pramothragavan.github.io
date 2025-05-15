let pyodide = null;
let ramseyReady = false;

function isDarkMode() {
  const htmlDark = document.documentElement.classList.contains('dark');
  const bodyDark = document.body.classList.contains('dark');
  
  return (htmlDark || bodyDark)
}




async function initRamsey() {
  if (pyodide && ramseyReady) return;
  pyodide = await loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/" });
  await pyodide.loadPackage(["matplotlib", "networkx"]);
  await pyodide.runPythonAsync(`
from pyodide.http import pyfetch
response = await pyfetch("/assets/ramsey.py")
with open("ramsey.py", "wb") as f:
    f.write(await response.bytes())
  `);
  await pyodide.runPythonAsync(`import ramsey`);
  ramseyReady = true;
}

async function runRamsey(params) {
  await initRamsey();
  if (!ramseyReady) return;
  const dark = isDarkMode();
  const col1 = dark ? "#EF88AD" : "blue";
  const col2 = dark ? "#B084CC" : "red";

  const code = `
import ramsey
result = ramsey.generate_ramsey_image(
  N=${params.N}, k=${params.k}, l=${params.l}, col1="${col1}", col2="${col2}"
)
result
`;
  let result = await pyodide.runPythonAsync(code);
  if (typeof result.toJs === "function") result = result.toJs();
  if (result instanceof Map) {
    const obj = {};
    for (const [k, v] of result.entries()) {
      obj[k] = typeof v.toJs === "function" ? v.toJs() : v;
    }
    result = obj;
  }

  document.getElementById("ramseyGraph").innerHTML = result.svg;
  document.getElementById("ramseyStatus").textContent = result.status;
}

function getParams() {
  return {
    N: parseInt(document.getElementById("NInput").value, 10),
    k: parseInt(document.getElementById("kInput").value, 10),
    l: parseInt(document.getElementById("lInput").value, 10),
  };
}

function setupRamseyControls() {
  ["N","k","l"].forEach(param => {
    const slider = document.getElementById(param + "Input");
    const label  = document.getElementById(param + "InputValue");
    slider.addEventListener("input", () => {
      label.textContent = slider.value;
      runRamsey(getParams());
    });
  });

  document.getElementById("ramseyRefresh")
          .addEventListener("click", () => runRamsey(getParams()));

  runRamsey(getParams());
}

window.addEventListener("DOMContentLoaded", setupRamseyControls);
