const express = require('express');
const { spawn } = require('child_process');
const OpenAI = require('openai');
const cors = require('cors');
const config = require('./config/config');
const fs = require('fs').promises;
const path = require('path');
const bodyParser = require('body-parser');
const debug = require('debug')('app:server');

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

// Modified analyze endpoint
app.post('/api/analyze', async (req, res, next) => {
  try {
    debug('Analyzing data with params:', { 
      questionLength: req.body.question?.length,
      dataSize: req.body.data?.length
    });

    const { question, data } = req.body;
    
    // Use provided data or fallback to stored data
    if (data) {
      currentData = data; // Update stored data if new data is provided
    } else if (!currentData) {
      return res.status(400).json({ error: 'No data available. Please upload data first.' });
    }

    // Prepare sample data for prompt
    const headers = Object.keys(currentData[0]);
    const sampleRows = currentData.slice(0, 5);
    const dataContext = {
      headers,
      sampleRows,
      totalRows: currentData.length
    };

    const codeCompletion = await openai.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: `You are a Python programming assistant that generates complete, executable scripts.
                   Your code must:
                   1. Include all necessary imports (pandas, json, sys)
                   2. Define a main function that:
                      - Takes input data via sys.argv[1] as JSON
                      - Returns results as JSON via print()
                   3. Include proper error handling
                   4. Follow this exact structure:

                   import pandas as pd
                   import json
                   import sys
                   # Other Imports

                   def modify_dataframe(data):
                       # Your data processing code here
                       # Must return: {'data': modified_df.to_dict('records'), 'changed_rows': changed_indices}

                   if __name__ == "__main__":
                       try:
                           input_data = json.loads(sys.argv[1])
                           result = modify_dataframe(input_data)
                           print(json.dumps(result))
                       except Exception as e:
                           print(json.dumps({
                               'error': str(e),
                               'data': [],
                               'changed_rows': []
                           }))` 
        },
        { 
          role: "user", 
          content: `Given this table structure:
                   Headers: ${JSON.stringify(headers)}
                   Sample rows (first 5 of ${currentData.length} total rows):
                   ${JSON.stringify(sampleRows, null, 2)}
                   
                   Task: ${question}
                   
                   Generate a complete Python script that processes this data and returns the result in the correct JSON format.` 
        }
      ],
      model: "gpt-3.5-turbo",
    });

    // Get the Python code and clean it
    let pythonCode = codeCompletion.choices[0].message.content;
    pythonCode = pythonCode.replace(/```python\n|```\n|```/g, '').trim();

    // No need to wrap the code since the LLM will generate complete script
    const tempFilePath = path.join(__dirname, 'temp_script.py');
    await fs.writeFile(tempFilePath, pythonCode);

    debug('Generated Python code:', pythonCode);

    // Save and execute Python code
    const pythonProcess = spawn('python', [
      tempFilePath,
      JSON.stringify(currentData)
    ]);
    
    let processedData = '';
    let errorData = '';
    
    pythonProcess.stdout.on('data', (data) => {
      processedData += data.toString();
      debug('Python stdout:', {
        raw: data.toString(),
        length: data.toString().length
      });
    });

    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
      debug('Python stderr:', {
        error: data.toString(),
        stack: new Error().stack
      });
    });

    pythonProcess.on('close', async (code) => {
      await fs.unlink(tempFilePath).catch(console.error);

      debug('Python process exit code:', code);
      debug('Final processed data:', processedData);
      debug('Error data:', errorData);

      if (code !== 0) {
        return res.status(500).json({ 
          error: `Python Error: ${errorData || 'Unknown error'}`,
          details: errorData,
          code: pythonCode 
        });
      }

      try {
        const result = JSON.parse(processedData);
        currentData = result.data;

        res.json({ 
          data: result.data,
          changedRows: result.changed_rows,
          analysis: `Operation completed. ${result.changed_rows.length} rows were modified.`,
          code: pythonCode,
          error: result.error // Include any Python-side errors
        });
      } catch (error) {
        res.status(500).json({ 
          error: 'Failed to parse Python output: ' + error.message,
          details: processedData,
          code: pythonCode
        });
      }
    });
  } catch (error) {
    debug('Error in analyze endpoint:', error);
    next(error);
  }
});

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
}); 