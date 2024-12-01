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
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const PlotSuggestor = require('./PlotSuggestedGraphs');
const DataCleaningRequest = require('./DataCleaningRequest');

// Validate environment variables
if (!process.env.OPENAI_API_KEY) {
    console.error('ERROR: OPENAI_API_KEY is not set in environment variables');
    process.exit(1);
}

const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Initialize the plot suggestor
const plotSuggestor = new PlotSuggestor(openai);

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
4. Try to standardize the data relevant if its unstructured for performing analysis over it by first analyzing the context/sample rows.
5. Include proper error handling

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
1. Include all necessary imports (pandas, json, sys, plotly)
2. Start directly with imports - no description text
3. Create clear and informative visualizations
4. Save plots as interactive HTML file and return plot_html and dont add any image related code
5. Use plotly for visualization

Example structure:
import pandas as pd
import json
import sys
import plotly.express as px
import plotly.graph_objects as go

def create_visualization(df):
    try:
        # Create plot using plotly, example plot below
        # fig = px.scatter(df, x=df.columns[0], y=df.columns[1])  # Example plot
        
        # Update layout for better appearance
        fig.update_layout(
            template='plotly_white',
            title_x=0.5,
            margin=dict(t=50, l=50, r=50, b=50)
        )
        
        # Save as HTML
        plot_path = 'plot.html'
        fig.write_html(plot_path, full_html=True, include_plotlyjs=True)
        
        # Read the HTML content
        with open(plot_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
        
        return html_content
            
    except Exception as e:
        raise Exception(f"Error creating visualization: {str(e)}")
    finally:
        # Cleanup
        if 'fig' in locals():
            fig.data = []
            fig.layout = {}
            del fig

def process_data(data):
    try:
        df = pd.DataFrame(data)
        
        html_content = create_visualization(df)
        
        return {
            'data': df.to_dict('records'),
            'plot_html': html_content,  # Return full HTML content
            'changed_rows': []
        }
    except Exception as e:
        print(json.dumps({
            'error': str(e),
            'data': [],
            'changed_rows': []
        }))
        sys.exit(1)

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
        }))
        sys.exit(1)`

// Modify the getRandomSampleRows function to handle mixed sampling
function getRandomSampleRows(data, selectedIndices = [], totalSamples = 15) {
  if (!data || !data.length) return [];
  
  let selectedSamples = [];
  let unselectedSamples = [];
  
  // Convert data to array if it's not already
  const dataArray = Array.isArray(data) ? data : Object.values(data);
  
  if (selectedIndices.length > 0) {
    // Get up to 7 samples from selected rows (or all if less)
    const selectedData = selectedIndices.map(index => ({
      ...dataArray[index],
      _rowIndex: index,
      _isSelected: true
    }));
    selectedSamples = selectedData
      .sort(() => 0.5 - Math.random())
      .slice(0, 7);
    
    // Get remaining samples from unselected rows to reach total of 15
    const remainingSamples = Math.max(15 - selectedSamples.length, 8);
    const unselectedData = dataArray
      .filter((_, index) => !selectedIndices.includes(index))
      .map((row, idx) => ({
        ...row,
        _rowIndex: idx,
        _isSelected: false
      }));
    unselectedSamples = unselectedData
      .sort(() => 0.5 - Math.random())
      .slice(0, remainingSamples);
  } else {
    // If no selection, get 15 samples (or all rows if less) from the full dataset
    unselectedSamples = dataArray
      .map((row, idx) => ({
        ...row,
        _rowIndex: idx,
        _isSelected: false
      }))
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.min(15, dataArray.length));
  }
  
  return [...selectedSamples, ...unselectedSamples];
}

// Add helper function to truncate data for command line
async function prepareDataForPython(data) {
  const jsonString = JSON.stringify(data);
  const timestamp = Date.now();
  const tempDataPath = path.join(tempDir, `data_${timestamp}.json`);
  await fsPromises.writeFile(tempDataPath, jsonString, 'utf8');
  return { type: 'file', path: tempDataPath };
}

// Centralized error handling function
function handleErrorResponse(res, error, pythonCode, processedData = '', errorData = '') {
  const errorMessage = error || 'Python execution failed';
  const pythonError = errorData || processedData;
  
  res.json({
    error: {
      message: errorMessage,
      pythonError: pythonError,
      code: pythonCode
    }
  });
}

// Modified analyze endpoint
app.post('/api/analyze', async (req, res, next) => {
  let tempDataPath = null;
  let pythonProcess = null;
  let responseHandled = false;
  
  try {
    const { question, data, selectedRows, selectedIndices } = req.body;
    
    const isVisualization = isVisualizationRequest(question);
    const systemPrompt = isVisualization ? visualizationPrompt : dataProcessingPrompt;
    
    if (data) {
      currentData = data;
    } else if (!currentData) {
      return res.status(400).json({ error: 'No data available. Please upload data first.' });
    }

    const headers = Object.keys(currentData[0]);
    const sampleRows = getRandomSampleRows(currentData, selectedIndices);
    
    // Separate samples and clean up metadata
    const selectedSamples = sampleRows
      .filter(row => row._isSelected)
      .map(row => {
        const { _isSelected, _rowIndex, ...cleanRow } = row;
        return { row: _rowIndex + 1, data: cleanRow };
      });
    
    const unselectedSamples = sampleRows
      .filter(row => !row._isSelected)
      .map(row => {
        const { _isSelected, _rowIndex, ...cleanRow } = row;
        return { row: _rowIndex + 1, data: cleanRow };
      });

    const preparedData = await prepareDataForPython(currentData);
    tempDataPath = preparedData.type === 'file' ? preparedData.path : null;

    // Calculate the range of selected rows if any
    let selectionInfo = '';
    if (selectedIndices?.length > 0) {
      const min = Math.min(...selectedIndices);
      const max = Math.max(...selectedIndices);
      selectionInfo = `Selected rows: ${selectedIndices.length} rows (range: ${min+1}-${max+1})`;
    }

    const userPrompt = `Given this table structure:
Headers: ${JSON.stringify(headers)}
${selectedIndices?.length > 0 
  ? `Selected rows (rows are indexed from 1 and not 0): ${selectedIndices.length} rows (range: rows ${Math.min(...selectedIndices) + 1} to ${Math.max(...selectedIndices) + 1})

Sample from selected rows (${selectedSamples.length} rows):
${JSON.stringify(selectedSamples, null, 2)}

Sample from other rows (${unselectedSamples.length} rows):
${JSON.stringify(unselectedSamples, null, 2)}`
  : `Random sample of data (showing 5 of ${currentData.length} total rows):
${JSON.stringify(sampleRows.map(row => {
    const { _isSelected, _rowIndex, ...cleanRow } = row;
    return cleanRow;
  }), null, 2)}`}

Note: Your code will receive the ENTIRE dataset (${currentData.length} rows) as input, not just this sample.
${isVisualization ? 'Create a visualization based on the request. Return the plot as a base64 encoded PNG image.' : 'Process the data according to the request.'}

Task: ${question}`;

    const codeCompletion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      model: "gpt-4o-mini",
    });

    // Get and save Python code
    let pythonCode = codeCompletion.choices[0].message.content;
    pythonCode = pythonCode.replace(/```python\n|```\n|```/g, '').trim();
    
    // Modify Python code if using file input
    if (preparedData.type === 'file') {
      const tempDataFilePath = path.join(tempDir, 'temp_data.json');
      await fsPromises.writeFile(tempDataFilePath, JSON.stringify(currentData), 'utf8');
      
      pythonCode = pythonCode.replace(
        'input_data = json.loads(sys.argv[1])',
        `with open("${tempDataFilePath.replace(/\\/g, '\\\\')}", 'r', encoding='utf-8') as f:
            input_data = json.load(f)`
      );
    }

    // Execute Python script with proper file handling
    const tempFilePath = path.join(tempDir, `script_${Date.now()}.py`);
    await fsPromises.writeFile(tempFilePath, pythonCode, 'utf8');

    // Add debug logs for Python process
    debug('Executing Python script with:', {
      isFileInput: preparedData.type === 'file',
      tempFilePath,
      dataPath: tempDataPath,
      codeLength: pythonCode.length
    });

    pythonProcess = spawn('python', [tempFilePath, tempDataPath], {
      encoding: 'utf8'
    });

    pythonProcess.on('error', (error) => {
      debug('Python process error:', {
        error: error.message,
        code: error.code,
        stack: error.stack,
        killed: pythonProcess.killed
      });
      
      if (!responseHandled) {
        responseHandled = true;
        handleErrorResponse(res, error, pythonCode);
      }
    });

    let processedData = '';
    let errorData = '';

    pythonProcess.stdout.setEncoding('utf8');
    pythonProcess.stderr.setEncoding('utf8');

    pythonProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      processedData += chunk;
      debug('Python stdout chunk:', {
        length: chunk.length,
        preview: chunk.substring(0, 200) + (chunk.length > 200 ? '...' : '')
      });

      /*if (!responseHandled) {
        responseHandled = true;
        handleErrorResponse(res, chunk, pythonCode);
      }*/
    });

    pythonProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      errorData += chunk;
      debug('Python stderr chunk:', {
        error: chunk,
        length: chunk.length
      });

       if (!responseHandled) {
         responseHandled = true;
         handleErrorResponse(res, chunk, pythonCode);
       }
    });

    pythonProcess.on('close', async (code) => {
      debug('Python process closed:', {
        exitCode: code,
        processedDataLength: processedData.length,
        errorDataLength: errorData.length,
        killed: pythonProcess.killed
      });

      // Clean up both script and data files
      /*await cleanupFiles(
        tempFilePath,
        tempDataPath,
        path.join(tempDir, 'temp_data.json')
      );*/

      if (!responseHandled) {
        responseHandled = true;
        
        if (code !== 0 || errorData) {
          return handleErrorResponse(res, new Error('Python execution failed'), pythonCode, processedData, errorData);
        }
        
        try {
          const sanitizedData = processedData.replace(/: NaN/g, ': "NaN"');
          let result;
          
          try {
            // Parse with proper encoding
            result = JSON.parse(sanitizedData);
          } catch (parseError) {
            // If it's not JSON, it might be a simple output value
            if (processedData.trim()) {
              return res.json({ 
                data: currentData,
                changedRows: [],
                analysis: processedData.trim(),
                code: pythonCode,
              });
            }
            throw parseError;
          }
          
          // For visualization requests, allow empty data if plot exists
          if (isVisualization && result.plot_html) {
            debug('Visualization generated');
            return res.json({ 
              data: currentData,
              changedRows: [],
              plot_html: result.plot_html,  // This will now contain the HTML content
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
              plot_html: result.plot_html,
              analysis: result.plot_html 
                ? 'Generated visualization' 
                : `Operation completed. ${result.changed_rows?.length || 0} rows were modified.`,
              code: pythonCode,
            });
          } else if (result.error) {
            return handleErrorResponse(res, result.error, pythonCode, processedData);
          } else {
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
          
          const looksLikeError = errorData.length > 0 || 
                                processedData.toLowerCase().includes('error') ||
                                processedData.toLowerCase().includes('exception');
          
          if (looksLikeError) {
            return handleErrorResponse(res, new Error('Python execution failed'), pythonCode, processedData, errorData);
          } else {
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
      
      // Clean up all temporary files
      /*await cleanupFiles(
        tempFilePath,
        tempDataPath,
        path.join(tempDir, 'temp_data.json')
      );*/
      
      debug('Error in analyze endpoint:', error);
      return handleErrorResponse(res, error, '');
    }
  }
});

// Add new endpoint for converting plot HTML to image
app.post('/api/convert-plot', async (req, res) => {
  const { html } = req.body;
  const tempHtmlPath = path.join(tempDir, `plot_${Date.now()}.html`).replace(/\\/g, '\\\\');
  const tempImagePath = path.join(tempDir, `plot_${Date.now()}.png`).replace(/\\/g, '\\\\');
  const scriptPath = path.join(tempDir, `convert_${Date.now()}.py`);

  try {
    // Save HTML to temporary file
    await fsPromises.writeFile(tempHtmlPath, html);

    // Create Python script to convert HTML to image
    const pythonCode = `
import plotly.io as pio
import base64
import sys

try:
    # Load the HTML file
    with open(r"${tempHtmlPath}", "r", encoding='utf-8') as f:
        html_content = f.read()

    # Use plotly.io to render the figure
    fig = pio.from_html(html_content)

    # Save the figure as an image
    fig.write_image(r"${tempImagePath}", format="png", scale=2)  # scale=2 for better quality

    # Read the image and convert to base64
    with open(r"${tempImagePath}", "rb") as image_file:
        encoded_image = base64.b64encode(image_file.read()).decode('utf-8')
    
    print(encoded_image)
except Exception as e:
    print(f"Error: {str(e)}", file=sys.stderr)
    sys.exit(1)
`;

    // Write Python script to temp file
    await fsPromises.writeFile(scriptPath, pythonCode);

    // Execute Python script
    const { stdout, stderr } = await execAsync(`python "${scriptPath}"`);
    
    if (stderr) {
      throw new Error(stderr);
    }

    res.json({ image: stdout.trim() });

  } catch (error) {
    console.error('Error converting plot:', error);
    res.status(500).json({ 
      error: 'Failed to convert plot to image',
      details: error.message 
    });
  } finally {
    // Clean up temporary files
    try {
      //await cleanupFiles(tempHtmlPath, tempImagePath, scriptPath);
    } catch (cleanupError) {
      console.error('Error cleaning up files:', cleanupError);
    }
  }
});

// Add new endpoint for plot suggestions
app.post('/api/suggest-plots', async (req, res) => {
  try {
    const { data, selectedIndices } = req.body;
    
    if (!data || !data.length) {
      return res.status(400).json({ error: 'No data available' });
    }

    const headers = Object.keys(data[0]);
    const suggestions = await plotSuggestor.suggestPlots(data, headers, selectedIndices);

    res.json({ suggestions });
  } catch (error) {
    console.error('Error suggesting plots:', error);
    res.status(500).json({ 
      error: 'Failed to generate plot suggestions',
      details: error.message 
    });
  }
});

app.use((req, res, next) => {
  res.header('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
}); 

// Remove cleaning from analyze endpoint and add new endpoints
app.post('/api/clean/suggest', async (req, res) => {
  try {
    const { question, data } = req.body;
    const cleaningHandler = new DataCleaningRequest(openai);
    const result = await cleaningHandler.process(question, data);
    // Store the handler instance in app.locals for later use
    app.locals.cleaningHandler = cleaningHandler;
    res.json(result);
  } catch (error) {
    debug('Error in cleaning suggestions:', error);
    res.status(500).json({ 
      error: 'Failed to generate cleaning suggestions',
      details: error.message 
    });
  }
});

app.post('/api/clean/execute', async (req, res) => {
  try {
    const { data, suggestions } = req.body;
    
    // Validate suggestions
    if (!Array.isArray(suggestions)) {
      throw new Error('Suggestions must be an array');
    }

    const cleaningHandler = app.locals.cleaningHandler || new DataCleaningRequest(openai);
    
    const result = await cleaningHandler.executeCleaning(data, suggestions);
    
    res.json({
      data: result.data,
      changedRows: result.changedRows,
      analysis: `Applied ${suggestions.length} cleaning operations`,
      code: result.pythonCode
    });
  } catch (error) {
    debug('Error executing cleaning:', error);
    res.status(500).json({ 
      error: {
        message: error.message || 'Failed to execute cleaning operations',
        pythonError: error.pythonError,
        code: error.code
      }
    });
  }
});