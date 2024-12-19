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
const PythonDebugger = require('./PythonDebugger');
const PythonExecutor = require('./PythonExecutor');
const dashboardRouter = require('./dashboardRouter');

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

// Add this helper function to prepare data by removing last row
function prepareDataForProcessing(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }
  // Remove the last row from the data
  return data.slice(0, -1);
}

// New endpoint to upload initial data
app.post('/api/upload', async (req, res) => {
  try {
    const { data } = req.body;
    const processedData = prepareDataForProcessing(data);
    currentData = processedData;
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
    
    return df.to_dict('records')

if __name__ == "__main__":
    try:
        input_data = json.loads(sys.argv[1])
        result = process_data(input_data)
        print(json.dumps({'data': result}))
    except Exception as e:
        sys.stderr.write(str(e))
        sys.exit(1)`;

const visualizationPrompt = `You are a Python programming assistant that generates complete, executable scripts.
Your code must:
1. Include all necessary imports (pandas, json, sys, plotly) and dont add any other imports mentioned in code 
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
def process_data(data):
    df = pd.DataFrame(data)
    
    html_content = create_visualization(df)
    
    return {
        'data': df.to_dict('records'),
        'plot_html': html_content,  # Return full HTML content
    }

if __name__ == "__main__":
    try:
        input_data = json.loads(sys.argv[1])
        result = process_data(input_data)
        print(json.dumps(result))
    except Exception as e:
        sys.stderr.write(str(e))
        sys.exit(1)`

// Modify the getRandomSampleRows function to handle mixed sampling
function getRandomSampleRows(data, selectedIndices = [], totalSamples = 40) {
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
    const remainingSamples = Math.max(40 - selectedSamples.length, 8);
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
    // If no selection, get 40 samples (or all rows if less) from the full dataset
    unselectedSamples = dataArray
      .map((row, idx) => ({
        ...row,
        _rowIndex: idx,
        _isSelected: false
      }))
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.min(40, dataArray.length));
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
function handleErrorResponse(errorString, pythonCode, processedData = '', errorData = '') {
  const errorMessage = errorString || 'Python execution failed';
  const pythonError = errorData || processedData;
  
  return {
    error: {
      message: errorMessage,
      pythonError: pythonError,
      code: pythonCode
    }
  };
}

// Modified analyze endpoint
app.post('/api/analyze', async (req, res, next) => {
  let tempDataPath = null;
  let pythonProcess = null;
  let responseHandled = false;
  
  try {
    const { question, data, selectedRows, selectedIndices, previousError } = req.body;
    
    // Remove last row from data before processing
    const cleanerData = prepareDataForProcessing(data);
    
    const isVisualization = isVisualizationRequest(question);
    const basePrompt = isVisualization ? visualizationPrompt : dataProcessingPrompt;
    const systemPrompt = previousError 
      ? `${basePrompt}\n\nPrevious attempt failed with error: ${previousError.message || previousError}. Please handle this error in your solution.`
      : basePrompt;
    
    if (cleanerData) {
      currentData = cleanerData;
    } else if (!currentData) {
      return res.status(400).json({ error: 'No data available. Please upload data first.' });
    }

    const headers = Object.keys(currentData[0]);
    // Adjust sample rows to work with processed data
    const sampleRows = getRandomSampleRows(currentData, 
      selectedIndices?.filter(idx => idx < currentData.length) || []);
    
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
  : `Random sample of data (showing 15 of ${currentData.length} total rows):
${JSON.stringify(sampleRows.map(row => {
    const { _isSelected, _rowIndex, ...cleanRow } = row;
    return cleanRow;
  }), null, 2)}`}

Note: Your code will receive the ENTIRE dataset (${currentData.length} rows) as input, not just this sample.
${isVisualization ? 'Create a visualization based on the user request. Create plots that actually help user understand the data, dont add unnecessary complexity to the plot. Keep note of the numerical values, and ensure quality plots with good data representation. Dont use flashy colors, relevant and graph related colors. Graph should somehow help user in identifying trends if possible and make the data come in a meaningful way in a sequential way. The numerical value should be represented in consistent way and not haphazard way and dont make too many assumption about the data .' : 'Process the data according to the user request.'}

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
        handleErrorResponse(error, pythonCode);
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
        const error = handleErrorResponse(chunk, pythonCode);
        res.json(error);
      }
    });

    pythonProcess.on('close', async (code) => {
      debug('Python process closed:', {
        exitCode: code,
        processedDataLength: processedData.length,
        errorDataLength: errorData.length,
        killed: pythonProcess.killed
      });

      if (!responseHandled) {
        responseHandled = true;
        
        // Check for error conditions
        if (code !== 0 || errorData) {
          return handleErrorResponse(res, new Error(errorData || 'Python execution failed'), pythonCode);
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
              plot_html: result.plot_html,
              analysis: result.plot_html 
                ? 'Generated visualization' 
                : `Operation completed.`,
              code: pythonCode,
            });
          } else if (result.error) {
            const error = handleErrorResponse(result.error, pythonCode, processedData);
            return res.json(error);
          } else {
            return res.json({
              data: currentData,
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
            const errorResponse = handleErrorResponse(
              new Error('Python execution failed'), 
              pythonCode, 
              processedData, 
              errorData
            );
            return res.json(errorResponse);
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
      const errorResponse = handleErrorResponse(error, '');
      return res.json(errorResponse);
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 

// Remove cleaning from analyze endpoint and add new endpoints
app.post('/api/clean/suggest', async (req, res) => {
  try {
    const { data, question } = req.body;
    const processedData = prepareDataForProcessing(data);
    
    const cleaningHandler = new DataCleaningRequest(openai);
    const result = await cleaningHandler.process(question, processedData);
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
    const { data, suggestions, context, previousError } = req.body;
    const processedData = prepareDataForProcessing(data);
    
    const cleaningHandler = app.locals.cleaningHandler || new DataCleaningRequest(openai);
    const result = await cleaningHandler.executeCleaning(processedData, suggestions);
    
    res.json({
      data: result.data,
      headers: Object.keys(result.data[0] || {}),
      analysis: `Applied ${suggestions.length} cleaning operations`,
      code: result.pythonCode
    });
  } catch (error) {
    debug('Error executing cleaning:', error);
    res.status(500).json({ 
      error: {
        message: error.error,
        pythonError: error.pythonError,
        code: error.code
      }
    });
  }
});

// Add new endpoint for suggesting table header
app.post('/api/suggest-header', async (req, res) => {
  try {
    const { data, fileName } = req.body;
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid data format. Expected non-empty array of objects.' 
      });
    }

    // Get sample data for header suggestion
    const sampleData = data.slice(0, 5);
    const headers = Object.keys(sampleData[0] || {});

    const systemPrompt = `You are a data analysis assistant. Based on the table structure and sample data, suggest a clear and concise header/title for this dataset. Keep it short and professional.`;
    const userPrompt = `
Table Headers: ${JSON.stringify(headers)}
Sample Data: ${JSON.stringify(sampleData, null, 2)}
File Name: ${fileName || 'Untitled'}

Suggest a clear, professional title for this dataset that describes its content. Keep it under 60 characters.`;

    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 60
    });

    const suggestedTitle = completion.choices[0].message.content.trim();
    res.json({ 
      title: suggestedTitle,
      stats: {
        rowCount: data.length,
        columnCount: headers.length
      }
    });
  } catch (error) {
    debug('Error suggesting header:', error);
    res.status(500).json({ 
      error: 'Failed to generate header suggestion',
      details: error.message 
    });
  }
});

const pyDebugger = new PythonDebugger();

const pythonExecutor = new PythonExecutor();

app.post('/api/debug/start', async (req, res) => {
  try {
    const { code, data, breakpoints } = req.body;
    await pythonExecutor.executeCode(code, data, { 
      debug: true, 
      breakpoints 
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Debug session error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/debug/stop', (req, res) => {
  pyDebugger.stop();
  res.json({ success: true });
});

// Mount the dashboard router with a specific prefix
app.use('/api/dashboard', dashboardRouter);
module.exports = app;