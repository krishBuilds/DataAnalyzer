const debug = require('debug')('app:cleaning');
const { spawn } = require('child_process');
const path = require('path');
const fsPromises = require('fs').promises;
const fs = require('fs');

class DataCleaningRequest {
  constructor(openai) {
    this.openai = openai;
    this.chatHistory = [];
  }

  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  getOptimizedDataset(data) {
    const TARGET_TOKEN_LIMIT = 14000;
    const BUFFER = 2000;
    const AVAILABLE_TOKENS = TARGET_TOKEN_LIMIT - BUFFER;

    let processData = [...data];
    let jsonData = JSON.stringify(processData, null, 2);
    let estimatedTokens = this.estimateTokens(jsonData);

    debug(`Initial estimated tokens: ${estimatedTokens} for ${processData.length} rows`);

    if (estimatedTokens <= AVAILABLE_TOKENS) {
      return {
        data: processData,
        tokenCount: estimatedTokens,
        rowCount: processData.length
      };
    }

    const tokensPerRow = estimatedTokens / processData.length;
    const targetRows = Math.floor(AVAILABLE_TOKENS / tokensPerRow);
    const step = Math.ceil(data.length / targetRows);

    processData = data.filter((_, index) => index % step === 0);
    jsonData = JSON.stringify(processData, null, 2);
    estimatedTokens = this.estimateTokens(jsonData);

    debug(`Final optimization: ${processData.length} rows with ~${estimatedTokens} tokens`);

    return {
      data: processData,
      tokenCount: estimatedTokens,
      rowCount: processData.length
    };
  }

  cleanJsonResponse(response) {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      const lines = response.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('```'));

      return {
        suggestions: lines.filter(line => 
          line.length > 0 && 
          !line.toLowerCase().includes('suggestions') &&
          !line.startsWith('{') &&
          !line.startsWith('}')
        )
      };
    } catch (error) {
      debug('Error parsing response:', error);
      return {
        suggestions: [
          "Error parsing suggestions. Please try again.",
          "Original error: " + error.message
        ]
      };
    }
  }

  async process(question, data, selectedIndices) {
    let pythonCode = '';
    try {
      const systemPrompt = `You are a data cleaning expert specializing in Python and pandas. Generate precise, efficient, and error-free code for data cleaning tasks.

Key Requirements:
1. Use ONLY pandas and basic Python libraries (no external packages)
2. Handle ALL possible errors and edge cases
3. Process operations sequentially and safely
4. Validate data types before operations
5. Include proper error messages
6. Maintain data integrity
7. Document each cleaning step
8. Return the cleaned dataset in the original format

Return format:
{
  "suggestions": [
    "Clear, specific cleaning step 1",
    "Clear, specific cleaning step 2",
    ...
  ]
}`;

      const { data: processData, tokenCount, rowCount } = this.getOptimizedDataset(data);

      const userPrompt = `Analyze this dataset and provide specific cleaning steps:
Dataset Info:
- Total Rows: ${data.length}
- Sample Size: ${rowCount} rows
- Estimated Tokens: ${tokenCount}
- Headers: ${JSON.stringify(Object.keys(data[0]))}

Sample Data:
${JSON.stringify(processData, null, 2)}

User Question: ${question}

Guidelines:
1. Focus on data quality and consistency
2. Check for and handle:
   - Missing values
   - Inconsistent formats
   - Data type mismatches
   - Outliers
   - Duplicate entries
   - Invalid values
3. Suggest specific column renamings if needed
4. Recommend format standardization where applicable
5. Identify and handle data type conversions
6. Do above if they make sense and help in cleaning the data that user might be wanting for their data

Return ONLY the JSON object with clear, actionable suggestions.`;

      const completion = await this.openai.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        model: "gpt-4o-mini",
        temperature: 0.1,
        max_tokens: 1500
      });

      const suggestions = this.cleanJsonResponse(completion.choices[0].message.content);

      return {
        data: data,
        analysis: "Suggested cleaning steps:",
        suggestions: suggestions.suggestions
      };

    } catch (error) {
      throw {
        error: error.message,
        code: pythonCode,
        pythonError: error.pythonError
      };
    }
  }

  async executeCleaning(data, suggestions) {
    try {
      const systemPrompt = `You are a Python code generator. Generate ONLY the Python code without any explanations or markdown formatting. The code must:
1. Start with imports
2. Include the process_data function
3. Include the main block
4. NO explanatory text or markdown code blocks
5. NO additional comments except for operation steps`;

      const userPrompt = `Write ONLY the Python code (no explanations) that implements these cleaning steps:
${Array.isArray(suggestions) 
  ? suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')
  : suggestions}

Required code structure:
import pandas as pd
import json
import sys

def process_data(data):
    try:
        df = pd.DataFrame(data)
        if df.empty:
            return {'error': 'Empty dataset', 'data': data}
        
        # cleaning operations here
        
        return {'data': df.to_dict('records')}
    except Exception as e:
        return {'error': str(e), 'data': data}

if __name__ == "__main__":
    try:
        input_data = json.load(sys.stdin)
        result = process_data(input_data)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'error': str(e), 'data': []}))`;

      const completion = await this.openai.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        model: "gpt-4o-mini",
        temperature: 0.1
      });

      // Clean the response to ensure we only get Python code
      let pythonCode = completion.choices[0].message.content;
      
      // Remove any markdown code blocks or explanatory text
      pythonCode = pythonCode
        .replace(/```python\n|```\n|```/g, '')
        .trim()
        .split('\n')
        .filter(line => 
          !line.toLowerCase().includes('here') && 
          !line.toLowerCase().includes('python code') &&
          !line.toLowerCase().includes('following') &&
          line.trim() !== ''
        )
        .join('\n');

      // Ensure the code starts with imports
      if (!pythonCode.startsWith('import')) {
        pythonCode = `import pandas as pd\nimport json\nimport sys\n\n${pythonCode}`;
      }

      const tempDir = path.join(__dirname, 'temp');
      if (!fs.existsSync(tempDir)) {
        await fsPromises.mkdir(tempDir, { recursive: true });
      }

      const tempDataPath = path.join(tempDir, `data_${Date.now()}.json`);
      const tempScriptPath = path.join(tempDir, `script_${Date.now()}.py`);

      await fsPromises.writeFile(tempDataPath, JSON.stringify(data), 'utf8');
      await fsPromises.writeFile(tempScriptPath, pythonCode, 'utf8');

      debug('Executing Python script:', {
        scriptPath: tempScriptPath,
        dataPath: tempDataPath
      });

      const pythonProcess = spawn('python', [tempScriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        encoding: 'utf8'
      });

      return new Promise((resolve, reject) => {
        let processedData = '';
        let errorData = '';

        pythonProcess.stdin.write(JSON.stringify(data));
        pythonProcess.stdin.end();

        pythonProcess.stdout.on('data', (data) => {
          processedData += data.toString('utf8');
        });

        pythonProcess.stderr.on('data', (data) => {
          errorData += data.toString('utf8');
          debug('Python stderr:', data.toString('utf8'));
        });

        pythonProcess.on('close', async (code) => {
          try {
            if (code !== 0) {
              throw new Error(errorData || 'Python execution failed');
            }

            if (!processedData.trim()) {
              throw new Error('No output from Python script');
            }

            const result = JSON.parse(processedData);
            
            if (result.error) {
              throw new Error(result.error);
            }

            resolve({
              data: result.data || data,
              pythonCode,
              suggestions
            });
          } catch (error) {
            reject({
              error: error.message,
              pythonError: errorData,
              code: pythonCode
            });
          }
        });
      });
    } catch (error) {
      throw {
        error: error.message,
        pythonError: error.pythonError,
        code: error.code
      };
    }
  }
}

module.exports = DataCleaningRequest; 