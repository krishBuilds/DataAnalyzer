const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

class PythonExecutor {
  constructor() {
    this.debugPort = 5678;
    this.tempDir = path.join(__dirname, 'temp');
    this.debugProcess = null;
  }

  async initialize() {
    await fs.mkdir(this.tempDir, { recursive: true });
  }

  async executeCode(code, data, options = {}) {
    const { debug = false, breakpoints = [] } = options;
    const scriptPath = path.join(this.tempDir, `script_${Date.now()}.py`);
    
    let pythonCode = this.preparePythonCode(code, data, debug, breakpoints);
    await fs.writeFile(scriptPath, pythonCode);

    if (debug) {
      return this.startDebugSession(scriptPath, data);
    } else {
      return this.executeNormally(scriptPath, data);
    }
  }

  preparePythonCode(code, data, debug, breakpoints) {
    let pythonCode = '';
    
    if (debug) {
      pythonCode += `
import debugpy
debugpy.configure({"wait_for_client": True})
debugpy.listen(("localhost", ${this.debugPort}))
`;
      breakpoints.forEach(bp => {
        pythonCode += `debugpy.breakpoint(${bp})\n`;
      });
    }

    pythonCode += `
import pandas as pd
import json
import sys

df = pd.DataFrame(${JSON.stringify(data)})
${code}
`;

    return pythonCode;
  }

  async startDebugSession(code, data, breakpoints = []) {
    const debugCode = `
import debugpy
debugpy.listen(${this.debugPort})
debugpy.wait_for_client()

${code}
`;

    const scriptPath = path.join(this.tempDir, `debug_${Date.now()}.py`);
    await fs.writeFile(scriptPath, debugCode);

    this.debugProcess = spawn('python', [scriptPath], {
      env: { ...process.env, PYTHONPATH: process.env.PYTHONPATH || '.' }
    });

    this.debugProcess.stdout.on('data', (data) => {
      console.log('Python Debug Output:', data.toString());
    });

    this.debugProcess.stderr.on('data', (data) => {
      console.error('Python Debug Error:', data.toString());
    });

    return new Promise((resolve, reject) => {
      this.debugProcess.on('error', reject);
      setTimeout(() => {
        resolve({ success: true });
      }, 1000); // Give debugpy time to start
    });
  }

  stop() {
    if (this.debugProcess) {
      this.debugProcess.kill();
      this.debugProcess = null;
    }
  }

  async executeNormally(scriptPath, data) {
    // Normal execution code here
  }
}

module.exports = PythonExecutor; 