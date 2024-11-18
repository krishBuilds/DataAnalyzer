const express = require('express');
const { spawn } = require('child_process');
const OpenAI = require('openai');
const cors = require('cors');
const config = require('./config/config');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const bodyParser = require('body-parser');
const debug = require('debug')('app:server');
const tempDir = path.join(__dirname, 'temp');

// Validate environment variables
if (!process.env.OPENAI_API_KEY) {
    console.error('ERROR: OPENAI_API_KEY is not set in environment variables');
    process.exit(1);
}

const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middleware for debugging requests
app.use((req, res, next) => {
    debug(`${req.method} ${req.path}`);
    next();
});

app.use(bodyParser.json({limit: '100mb'}));
app.use(bodyParser.urlencoded({limit: '100mb', extended: true}));

app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
    methods: ['GET', 'POST'],
    credentials: true
}));

// Error handling middleware with detailed logging
app.use((err, req, res, next) => {
    console.error('Error details:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });
    
    res.status(500).json({ 
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
    });
});

let currentData = null; // Store current data in memory

// Ensure temp directory exists
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// New endpoint to upload initial data
app.post('/api/upload', async (req, res) => {
  try {
    const { data } = req.body;
    currentData = data;
    res.json({ message: 'Data uploaded successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add this helper function
function sanitizePythonCode(code) {
  // Remove any markdown code blocks
  code = code.replace(/```python\n|```\n|```/g, '').trim();
  
  // Split into lines
  let lines = code.split('\n');
  
  // Filter out any standalone braces
  lines = lines.filter(line => line.trim() !== '{' && line.trim() !== '}');
  
  // Ensure proper indentation
  lines = lines.map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('def ') || trimmed.startsWith('if ') || trimmed.startsWith('try:')) {
      return line;  // Keep original indentation for control structures
    }
    return line.trimEnd();  // Remove trailing whitespace only
  });
  
  return lines.join('\n');
}

// Add this helper function to detect visualization requests
function isVisualizationRequest(question) {
  const visualKeywords = [
    'plot', 'graph', 'chart', 'visualize', 'visualization',
    'histogram', 'scatter', 'bar', 'pie', 'line', 'box',
    'distribution', 'trend', 'correlation', 'show'
  ];
  
  return visualKeywords.some(keyword => 
    question.toLowerCase().includes(keyword)
  );
}

// Add these template prompts at the top of the file
const dataProcessingPrompt = `You are a Python programming assistant that generates complete, executable scripts.
Your code must:
1. Include necessary imports (pandas, json, sys)
2. Start directly with imports - no description text
3. Process the ENTIRE input dataset, not just the sample rows
4. Include proper error handling

Example structure:
import pandas as pd
import json
import sys

def process_data(data):
    # Convert input JSON to DataFrame
    df = pd.DataFrame(data)
    
    # Your data processing code here
    # Process the entire DataFrame, not just the sample
    
    return {
        'data': df.to_dict('records'),
        'changed_rows': []  # Indices of modified rows
    }

if __name__ == "__main__":
    try:
        input_data = json.loads(sys.argv[1])
        result = process_data(input_data)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({
            'error': str(e),
            'data': [],
            'changed_rows': []
        }))`;

const visualizationPrompt = `You are a Python programming assistant that generates complete, executable scripts.
Your code must:
1. Include all necessary imports (pandas, json, sys, matplotlib, seaborn, io, base64)
2. Start directly with imports - no description text
3. Create clear and informative visualizations
4. Include proper error handling

Example structure:
import pandas as pd
import json
import sys
import matplotlib.pyplot as plt
import seaborn as sns
import io
import base64
import re  # Add regex support

def create_visualization(df):
    # Set style using matplotlib directly instead of seaborn
    plt.style.use('default')  # Using default style instead of seaborn
    plt.figure(figsize=(12, 6))
    
    # Create the visualization
    # Your plotting code here using either plt or sns
    
    # Save plot to buffer
    buffer = io.BytesIO()
    plt.savefig(buffer, format='png', bbox_inches='tight', dpi=300, 
                facecolor='white', edgecolor='none')
    buffer.seek(0)
    image_base64 = base64.b64encode(buffer.getvalue()).decode()
    plt.close()
    return image_base64

def process_data(data):
    df = pd.DataFrame(data)
    
    # Your pre processing code to make the data ready for visualization

    # Create visualization
    plot_base64 = create_visualization(df)
    
    return {
        'data': df.to_dict('records'),
        'plot': plot_base64,
        'changed_rows': []
    }

if __name__ == "__main__":
    try:
        input_data = json.loads(sys.argv[1])
        result = process_data(input_data)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({
            'error': str(e),
            'data': [],
            'changed_rows': []
        }))`;

// Add helper function to get random sample rows
function getRandomSampleRows(data, sampleSize = 5) {
  if (!data || data.length <= sampleSize) return data;
  
  const shuffled = [...data].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, sampleSize);
}

// Add helper function to truncate data for command line
async function prepareDataForPython(data) {
  const jsonString = JSON.stringify(data);
  const MAX_ARG_LENGTH = 30000;
  
  if (jsonString.length > MAX_ARG_LENGTH) {
    const tempDataPath = path.join(tempDir, 'temp_data.json');
    await fsPromises.writeFile(tempDataPath, jsonString);
    return { type: 'file', path: tempDataPath };
  }
  
  return { type: 'arg', data: jsonString };
}

// Modified analyze endpoint
app.post('/api/analyze', async (req, res, next) => {
  let tempDataPath = null;
  let pythonProcess = null;
  let responseHandled = false;
  
  try {
    const { question, data } = req.body;
    const isVisualization = isVisualizationRequest(question);
    const systemPrompt = isVisualization ? visualizationPrompt : dataProcessingPrompt;
    
    if (data) {
      currentData = data;
    } else if (!currentData) {
      return res.status(400).json({ error: 'No data available. Please upload data first.' });
    }

    const headers = Object.keys(currentData[0]);
    const sampleRows = getRandomSampleRows(currentData, 5);
    const preparedData = await prepareDataForPython(currentData);
    tempDataPath = preparedData.type === 'file' ? preparedData.path : null;

    const userPrompt = `Given this table structure:
Headers: ${JSON.stringify(headers)}
Random sample of data (showing 5 of ${currentData.length} total rows):
${JSON.stringify(sampleRows, null, 2)}

Note: Your code will receive the ENTIRE dataset (${currentData.length} rows) as input, not just this sample.
${isVisualization ? 'Create a visualization based on the request. Return the plot as a base64 encoded PNG image.' : 'Process the data according to the request.'}

Task: ${question}

Generate a complete Python script that processes the entire dataset and returns the result in the correct JSON format.`;

    const codeCompletion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      model: "gpt-3.5-turbo",
    });

    // Get and save Python code
    let pythonCode = codeCompletion.choices[0].message.content;
    pythonCode = pythonCode.replace(/```python\n|```\n|```/g, '').trim();
    
    // Modify Python code if using file input
    if (preparedData.type === 'file') {
      const tempDataFilePath = path.join(tempDir, 'temp_data.json');
      await fsPromises.writeFile(tempDataFilePath, JSON.stringify(currentData));
      
      pythonCode = pythonCode.replace(
        'input_data = json.loads(sys.argv[1])',
        `input_data = json.load(open("${tempDataFilePath.replace(/\\/g, '\\\\')}"))`
      );
    }

    // Execute Python script with proper file handling
    const tempFilePath = path.join(tempDir, `script_${Date.now()}.py`);
    await fsPromises.writeFile(tempFilePath, pythonCode);

    // Add debug logs for Python process
    debug('Executing Python script with:', {
      isFileInput: preparedData.type === 'file',
      tempFilePath,
      dataPath: tempDataPath,
      codeLength: pythonCode.length
    });

    pythonProcess = spawn('python', 
      preparedData.type === 'file' 
        ? [tempFilePath]
        : [tempFilePath, preparedData.data]
    );

    pythonProcess.on('error', (error) => {
      debug('Python process error:', {
        error: error.message,
        code: error.code,
        stack: error.stack,
        killed: pythonProcess.killed
      });
      
      if (!responseHandled) {
        responseHandled = true;
        res.status(500).json({
          error: 'Failed to execute Python script',
          details: error.message,
          code: pythonCode
        });
      }
    });

    let processedData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      processedData += chunk;
      debug('Python stdout chunk:', {
        length: chunk.length,
        preview: chunk.substring(0, 200) + (chunk.length > 200 ? '...' : '')
      });
    });

    pythonProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      errorData += chunk;
      debug('Python stderr chunk:', {
        error: chunk,
        length: chunk.length
      });
    });

    pythonProcess.on('close', async (code) => {
      debug('Python process closed:', {
        exitCode: code,
        processedDataLength: processedData.length,
        errorDataLength: errorData.length,
        killed: pythonProcess.killed
      });

      // Clean up files first
      try {
        await Promise.all([
          fsPromises.unlink(tempFilePath).catch(err => {
            debug('Error cleaning up temp script:', err);
            return err;
          }),
          preparedData.type === 'file' ? fsPromises.unlink(path.join(tempDir, 'temp_data.json')).catch(err => {
            debug('Error cleaning up temp data:', err);
            return err;
          }) : Promise.resolve()
        ]);
        debug('Cleanup completed successfully');
      } catch (cleanupError) {
        debug('Cleanup error:', cleanupError);
      }

      if (!responseHandled) {
        responseHandled = true;
        
        try {
          const sanitizedData = processedData.replace(/: NaN/g, ': "NaN"');
          let result;
          
          try {
            // Try parsing as JSON first
            result = JSON.parse(sanitizedData);
          } catch (parseError) {
            // If it's not JSON, it might be a simple output value
            if (processedData.trim()) {
              return res.json({ 
                data: currentData, // Keep current data unchanged
                changedRows: [],
                analysis: processedData.trim(), // Use the raw output as analysis
                code: pythonCode,
              });
            }
            // If empty or invalid, treat as error
            throw parseError;
          }
          
          // For visualization requests, allow empty data if plot exists
          if (isVisualization && result.plot) {
            debug('Visualization generated without data changes');
            return res.json({ 
              data: currentData,
              changedRows: [],
              plot: result.plot,
              analysis: 'Generated visualization',
              code: pythonCode,
            });
          }
          
          // For non-visualization requests or when plot is missing
          if (!result.error && result.data && result.data.length > 0) {
            debug('Updating current data with new results');
            currentData = result.data;
            
            return res.json({ 
              data: result.data,
              changedRows: result.changed_rows || [],
              plot: result.plot,
              analysis: result.plot 
                ? 'Generated visualization' 
                : `Operation completed. ${result.changed_rows?.length || 0} rows were modified.`,
              code: pythonCode,
            });
          } else if (result.error) {
            // Only treat as error if explicitly marked as error
            return res.status(500).json({ 
              error: result.error,
              details: processedData,
              code: pythonCode
            });
          } else {
            // If no error and no data changes, treat as informative message
            return res.json({
              data: currentData,
              changedRows: [],
              analysis: result.message || processedData.trim() || 'Operation completed',
              code: pythonCode,
            });
          }
        } catch (error) {
          debug('Error parsing Python output:', {
            error: error.message,
            processedData: processedData.substring(0, 500) + (processedData.length > 500 ? '...' : '')
          });
          
          // Check if the output looks like an error message
          const looksLikeError = errorData.length > 0 || 
                                processedData.toLowerCase().includes('error') ||
                                processedData.toLowerCase().includes('exception');
          
          if (looksLikeError) {
            return res.status(500).json({ 
              error: 'Failed to parse Python output: ' + error.message,
              details: processedData,
              code: pythonCode
            });
          } else {
            // If it doesn't look like an error, treat as informative output
            return res.json({
              data: currentData,
              changedRows: [],
              analysis: processedData.trim(),
              code: pythonCode,
            });
          }
        }
      }
    });

  } catch (error) {
    if (!responseHandled) {
      responseHandled = true;
      if (pythonProcess) {
        pythonProcess.kill();
      }
      if (tempDataPath) {
        await fsPromises.unlink(tempDataPath).catch(console.error);
      }
      debug('Error in analyze endpoint:', error);
      next(error);
    }
  }
});

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
}); 