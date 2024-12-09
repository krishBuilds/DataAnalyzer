const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class PythonDebugger {
  constructor() {
    this.debugProcess = null;
    this.dataCallback = null;
  }

  async startDebugSession(code, data, breakpoints) {
    const debugScript = `
import debugpy
import pandas as pd
import json

# Enable debugging
debugpy.configure({"wait_for_client": True})
debugpy.listen(("localhost", 5678))

# Initialize DataFrame
df = pd.DataFrame(${JSON.stringify(data)})

# Add breakpoints
${breakpoints.map(bp => `debugpy.breakpoint(${bp})`).join('\n')}

# Your code
${code}

# Sync DataFrame
print("__DATAFRAME_SYNC__")
print(df.to_json(orient='records'))
`;

    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFile = path.join(tempDir, 'debug_script.py');
    await fs.promises.writeFile(tempFile, debugScript);

    this.debugProcess = spawn('python', ['-m', 'debugpy', '--listen', '5678', tempFile]);
    
    this.debugProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('__DATAFRAME_SYNC__')) {
        try {
          const dfData = JSON.parse(output.split('__DATAFRAME_SYNC__')[1].trim());
          if (this.dataCallback) {
            this.dataCallback(dfData);
          }
        } catch (error) {
          console.error('Error parsing DataFrame:', error);
        }
      }
    });

    this.debugProcess.stderr.on('data', (data) => {
      console.error(`Python Debug Error: ${data}`);
    });

    return new Promise((resolve) => {
      this.debugProcess.on('close', (code) => {
        console.log(`Debug process exited with code ${code}`);
        resolve();
      });
    });
  }

  onDataFrameUpdate(callback) {
    this.dataCallback = callback;
  }

  stop() {
    if (this.debugProcess) {
      this.debugProcess.kill();
      this.debugProcess = null;
    }
  }
}

module.exports = PythonDebugger;

