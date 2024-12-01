const debug = require('debug')('app:cleaning');
const { spawn } = require('child_process');
const path = require('path');
const fsPromises = require('fs').promises;
const fs = require('fs');

class DataCleaningRequest {
  constructor(openai) {
    this.openai = openai;
    this.chatHistory = []; // Store chat history
  }

  estimateTokens(text) {
    // GPT models typically use ~4 characters per token on average
    return Math.ceil(text.length / 4);
  }

  getOptimizedDataset(data) {
    const TARGET_TOKEN_LIMIT = 14000;
    const BUFFER = 2000; // Buffer for system prompt and other content
    const AVAILABLE_TOKENS = TARGET_TOKEN_LIMIT - BUFFER;
    
    // First try with all data
    let processData = [...data];
    let jsonData = JSON.stringify(processData, null, 2);
    let estimatedTokens = this.estimateTokens(jsonData);
    
    debug(`Initial estimated tokens: ${estimatedTokens} for ${processData.length} rows`);

    // If under limit, use all data
    if (estimatedTokens <= AVAILABLE_TOKENS) {
      return {
        data: processData,
        tokenCount: estimatedTokens,
        rowCount: processData.length
      };
    }

    // If over limit, calculate rows needed based on average tokens per row
    const tokensPerRow = estimatedTokens / processData.length;
    const targetRows = Math.floor(AVAILABLE_TOKENS / tokensPerRow);
    const step = Math.ceil(data.length / targetRows);
    
    // Take evenly distributed samples
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
      // Remove markdown code blocks and find the JSON content
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        // Parse the matched JSON content
        return JSON.parse(jsonMatch[0]);
      }
      
      // If no JSON object found, create a structured response from the text
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
      // Fallback: Split by newlines and create suggestions array
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
      const systemPrompt = `You are a data cleaning assistant. Analyze the dataset and suggest improvements to make it clean and ready for analysis. Focus on data consistency, empty values, formatting, and overall quality, and misrepresentation that might have crept in the data.

Return your suggestions in this exact format without any markdown:
{
  "suggestions": [
    "suggestion 1",
    "suggestion 2"
  ]
}`;

      const { data: processData, tokenCount, rowCount } = this.getOptimizedDataset(data);

      const userPrompt = `Dataset Analysis Request:
Total Rows in Dataset: ${data.length}
Analyzing ${rowCount} rows (~${tokenCount} estimated tokens).
Headers: ${JSON.stringify(Object.keys(data[0]))}
Sample Data:
${JSON.stringify(processData, null, 2)}

Question: ${question}

Analyze this data and list specific cleaning steps needed. Return only the JSON object with suggestions.`;

      const completion = await this.openai.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 1500
      });

      // Add assistant's response to chat history
      this.chatHistory.push({
        role: "assistant",
        content: completion.choices[0].message.content
      });

      const suggestions = this.cleanJsonResponse(completion.choices[0].message.content);

      return {
        data: data,
        changedRows: 0,
        analysis: "Here are the suggested cleaning steps:",
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
        // Initialize chat history if it doesn't exist
        if (!this.chatHistory) {
            this.chatHistory = [];
        }

        const systemPrompt = `You are a Python programming assistant that generates complete, executable scripts.
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
        # Read data from file instead of command line argument
        with open(sys.argv[1], 'r', encoding='utf-8') as f:
            input_data = json.load(f)
        
        result = process_data(input_data)
        print(json.dumps(result))
    except Exception as e:
        error_result = {
            'error': str(e),
            'data': [],
            'changed_rows': []
        }
        print(json.dumps(error_result))`;

        // Add the execution request to chat history with proper structure
        this.chatHistory.push(
            { 
                role: "user", 
                content: `Generate Python code to implement these cleaning steps:\n${
                    Array.isArray(suggestions) 
                        ? suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')
                        : suggestions
                }\n\nThe code should follow the template structure and return the cleaned data in the specified format.`
            }
        );

        const completion = await this.openai.chat.completions.create({
            messages: [
                ...this.chatHistory,
                { role: "system", content: systemPrompt }
            ],
            model: "gpt-4o-mini",
            temperature: 0.2
        });

        // Add assistant's response to chat history
        this.chatHistory.push({
            role: "assistant",
            content: completion.choices[0].message.content
        });

        let pythonCode = completion.choices[0].message.content;
        pythonCode = pythonCode.replace(/```python\n|```\n|```/g, '').trim();

        // Ensure temp directory exists
        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) {
            await fsPromises.mkdir(tempDir, { recursive: true });
        }

        // Write data and script to temp files
        const tempDataPath = path.join(tempDir, `data_${Date.now()}.json`);
        const tempScriptPath = path.join(tempDir, `script_${Date.now()}.py`);

        // Write data with proper encoding
        await fsPromises.writeFile(tempDataPath, JSON.stringify(data), 'utf8');
        await fsPromises.writeFile(tempScriptPath, pythonCode, 'utf8');

        debug('Executing Python script:', {
            scriptPath: tempScriptPath,
            dataPath: tempDataPath
        });

        // Execute Python script with proper encoding
        const pythonProcess = spawn('python', [tempScriptPath, tempDataPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            encoding: 'utf8'
        });

        return new Promise((resolve, reject) => {
            let processedData = '';
            let errorData = '';

            pythonProcess.stdout.on('data', (data) => {
                processedData += data.toString('utf8');
                debug('Python stdout:', data.toString('utf8'));
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

                    const sanitizedData = processedData.replace(/: NaN/g, ': "NaN"');
                    let result;
                    
                    try {
                        result = JSON.parse(sanitizedData);
                    } catch (parseError) {
                        debug('Error parsing Python output:', parseError);
                        debug('Raw output:', sanitizedData);
                        throw new Error(`Failed to parse Python output: ${parseError.message}`);
                    }

                    if (result.error) {
                        throw new Error(result.error);
                    }

                    resolve({
                        data: result.data || data,
                        changedRows: result.changed_rows || [],
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