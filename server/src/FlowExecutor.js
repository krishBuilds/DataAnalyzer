const OpenAI = require('openai');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const debug = require('debug')('app:flow-executor');

class FlowExecutor {
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.tempDir = path.join(__dirname, 'temp');
    // Ensure temp directory exists using synchronous operation
    if (!fsSync.existsSync(this.tempDir)) {
      fsSync.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async adaptCodeToCurrentData(code, prompt, sampleData, currentData) {
    try {
      const systemPrompt = `You are a Python data analysis expert. You must adapt the given code to work with the current dataset structure, only transform the methods mentioned such as process_data or create_visualization here. The code is most likely correct, only make minor adjustments here. The data was passed in similar format for original data and the current data is also in similar format
      Critical requirements:
      1. Maintain data integrity during transformations and keep in mind that operation is to be performed over current data here, so make the code accordingly and adjust the given code with minimal adjustments if required.
      2. Preserve the original operation's intent
      3. Return only executable Python code with proper error handling`;
      
      const userPrompt = `
Original Prompt: ${prompt}
Original Code: 
${code}

Original Sample Data Structure:
${JSON.stringify(sampleData, null, 2)}

\n\nCurrent Data Sample (first 15 rows):
${JSON.stringify(currentData.slice(0, 15), null, 2)}

\n\nCurrent Data Headers: ${Object.keys(currentData[0]).join(', ')}

Requirements:
1. Return executable Python code, that will run on the current data and not the original data
2. Stricly Don't make modifications coming under the main of the code here and don't add any unnecessary code anywhere and don't change the way accessing the input data here, use json.load(f) only to load input data amd dont access via the row key here, use the original method present in the input code`;

      const completion = await this.openai.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 1000
      });

      return completion.choices[0].message.content.replace(/```python\n|```\n|```/g, '').trim();
    } catch (error) {
      debug('Error adapting code:', error);
      throw new Error('Failed to adapt code to current data structure');
    }
  }

  async executePythonCode(pythonCode, data) {
    let tempFilePath = null;
    let tempDataPath = null;
    
    return new Promise(async (resolve, reject) => {
      let responseHandled = false;
      let pythonProcess = null;

      try {
        // Create temp files for code and data
        tempFilePath = path.join(this.tempDir, `flow_script_${Date.now()}.py`);
        tempDataPath = path.join(this.tempDir, `flow_data_${Date.now()}.json`);
        
        // Normalize data structure
        const normalizedData = Array.isArray(data) ? data : (data?.rows || []);
        
        debug('Writing data to temp file:', {
          dataType: typeof normalizedData,
          length: normalizedData.length,
          sample: JSON.stringify(normalizedData[0]).substring(0, 100)
        });

        // Write files with proper encoding
        await fs.writeFile(tempFilePath, pythonCode, 'utf8');
        await fs.writeFile(tempDataPath, JSON.stringify(normalizedData), 'utf8');

        pythonProcess = spawn('python', [tempFilePath, tempDataPath], {
          encoding: 'utf8'
        });

        let processedData = '';
        let errorData = '';

        // Set proper encodings
        pythonProcess.stdout.setEncoding('utf8');
        pythonProcess.stderr.setEncoding('utf8');

        pythonProcess.stdout.on('data', (data) => {
          const chunk = data.toString();
          processedData += chunk;
          debug('Python stdout chunk:', {
            length: chunk.length,
            preview: chunk.substring(0, 200)
          });
        });

        pythonProcess.stderr.on('data', (data) => {
          const chunk = data.toString();
          errorData += chunk;
          debug('Python stderr:', chunk);
        });

        pythonProcess.on('error', (error) => {
          debug('Python process error:', error);
          if (!responseHandled) {
            responseHandled = true;
            reject(new Error(`Python execution error: ${error.message}`));
          }
        });

        pythonProcess.on('close', async (code) => {
          try {

            if (code !== 0 || errorData) {
              throw new Error(errorData || 'Python execution failed');
            }

            // Parse output with proper sanitization
            const sanitizedData = processedData.replace(/: NaN/g, ': "NaN"');
            let result;
            
            try {
              result = JSON.parse(sanitizedData);
            } catch (parseError) {
              if (processedData.trim()) {
                result = {
                  data: data,
                  analysis: processedData.trim()
                };
              } else {
                throw parseError;
              }
            }

            resolve(result);

          } catch (error) {
            if (!responseHandled) {
              responseHandled = true;
              reject(error);
            }
          }
        });

      } catch (error) {
        if (!responseHandled) {
          responseHandled = true;
          if (pythonProcess) pythonProcess.kill();
          await this.cleanup(tempFilePath, tempDataPath);
          reject(error);
        }
      }
    });
  }

  async cleanup(...files) {
    for (const file of files) {
      if (file) {
        try {
          await fs.unlink(file);
        } catch (error) {
          debug('Error cleaning up file:', error);
        }
      }
    }
  }

  parseProcessedData(processedData) {
    try {
      const sanitizedData = processedData.replace(/: NaN/g, ': "NaN"');
      return JSON.parse(sanitizedData);
    } catch (error) {
      return {
        data: null,
        analysis: processedData.trim() || 'Operation completed'
      };
    }
  }

  async executeFlowStep({ flowId, type, currentData, headers, code, prompt, sampleData, file = null }) {
    try {
      debug('Executing flow step with:', { 
        flowId, 
        type,
        dataType: typeof currentData,
        isArray: Array.isArray(currentData),
        hasRows: currentData?.rows !== undefined
      });
      
      // Normalize currentData structure
      let dataToProcess;
      if (Array.isArray(currentData)) {
        dataToProcess = currentData;
      } else if (currentData?.rows && Array.isArray(currentData.rows)) {
        dataToProcess = currentData.rows;
      } else if (typeof currentData === 'object') {
        dataToProcess = [currentData];
      } else {
        throw new Error('Invalid data structure: Data must be an array or object with rows');
      }

      if (!dataToProcess.length) {
        throw new Error('Valid current data array is required for flow execution');
      }

      // Create sample data structure
      const sampleDataStructure = {
        headers: headers || Object.keys(dataToProcess[0]),
        rows: sampleData?.rows || dataToProcess.slice(0, 5)
      };

      const adaptedCode = await this.adaptCodeToCurrentData(
        code,
        prompt,
        sampleDataStructure,
        dataToProcess
      );

      const result = await this.executePythonCode(adaptedCode, dataToProcess);

      return {
        success: true,
        data: result.data || dataToProcess,
        output: result.output,
        analysis: result.analysis,
        plot_html: result.plot_html,
        adaptedCode
      };

    } catch (error) {
      debug('Flow step execution error:', error);
      throw new Error(`Flow execution failed: ${error.message}`);
    }
  }
}

module.exports = FlowExecutor;