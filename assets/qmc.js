async function runQMC() {
    console.log("runQMC started");
  
    // Load Pyodide from the CDN
    const pyodide = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/"
    });
    console.log("Pyodide loaded");
  
    // Load the numpy package
    await pyodide.loadPackage("numpy");
    console.log("Numpy package loaded");
  
    // Fetch and load the qmc.py file into Pyodide's virtual filesystem
    try {
      await pyodide.runPythonAsync(`
        from pyodide.http import pyfetch
        response = await pyfetch("/assets/qmc.py")
        with open("qmc.py", "wb") as f:
            f.write(await response.bytes())
      `);
      console.log("qmc.py loaded into virtual FS");
    } catch (error) {
      console.error("Error loading qmc.py:", error);
      return;
    }
  
    // Run the simulation and collect the results
    try {
      await pyodide.runPythonAsync(`import qmc`);
      console.log("qmc module imported");
  
      let result = await pyodide.runPythonAsync(`qmc.simulate_qmc(50, 0.7, 0.8, 0.5)`);
      console.log("Raw simulation result:", result);
  
      // Convert the PyProxy object to a JS object
      if (typeof result.toJs === "function") {
        result = result.toJs();
      }
      // If we received a Map, convert it to a plain object
      if (result instanceof Map) {
        const obj = {};
        for (const [key, val] of result.entries()) {
          obj[key] = (val && typeof val.toJs === "function") ? val.toJs() : val;
        }
        result = obj;
      }
      console.log("Final JS object result:", result);
  
      const { probs, coherences } = result;
      const labels = Array.from({ length: 50 }, (_, i) => i + 1);
  
      // Chart for probabilities
      const probCanvas = document.getElementById("qmcChartProb");
      if (!probCanvas) {
        console.error("Canvas with id 'qmcChartProb' not found");
        return;
      }
      const probCtx = probCanvas.getContext("2d");
  
      new Chart(probCtx, {
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
  
      // Chart for coherences
      const coherenceCanvas = document.getElementById("qmcChartCoherence");
      if (!coherenceCanvas) {
        console.error("Canvas with id 'qmcChartCoherence' not found");
        return;
      }
      const coherenceCtx = coherenceCanvas.getContext("2d");
  
      new Chart(coherenceCtx, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Site 1 Coherence",
              data: coherences.map(c => c[0]),
              borderWidth: 2,
              fill: false,
            },
            {
              label: "Site 2 Coherence",
              data: coherences.map(c => c[1]),
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
      console.log("Coherence chart rendered");
    } catch (error) {
      console.error("Error during simulation:", error);
    }
  }
  
  // Run once DOM is ready
  window.addEventListener("DOMContentLoaded", runQMC);
  