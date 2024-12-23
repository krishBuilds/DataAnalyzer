const { OpenAI } = require('openai');
const fs = require('fs').promises;
const path = require('path');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Import the visualization prompt from app.js
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
import json

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
        plot_path = 'src/plots/plot.html'
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
        
        # Process the data to make it compatible here for creating the plot
        
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
        sys.exit(1)`;

// First, add the getRandomSampleRows helper function
function getRandomSampleRows(data, selectedIndices = [], totalSamples = 30) {
  if (!data || !data.length) return [];
  
  let selectedSamples = [];
  let unselectedSamples = [];
  
  // Convert data to array if it's not already
  const dataArray = Array.isArray(data) ? data : Object.values(data);
  
  if (selectedIndices.length > 0) {
    // Get up to 10 samples from selected rows (or all if less)
    const selectedData = selectedIndices.map(index => ({
      ...dataArray[index],
      _rowIndex: index,
      _isSelected: true
    }));
    selectedSamples = selectedData
      .sort(() => 0.5 - Math.random())
      .slice(0, 10);
    
    // Get remaining samples from unselected rows to reach total of 30
    const remainingSamples = Math.max(30 - selectedSamples.length, 20);
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
    // If no selection, get 30 samples (or all rows if less) from the full dataset
    unselectedSamples = dataArray
      .map((row, idx) => ({
        ...row,
        _rowIndex: idx,
        _isSelected: false
      }))
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.min(30, dataArray.length));
  }
  
  return [...selectedSamples, ...unselectedSamples];
}

class PlotSuggestor {
  constructor(openai) {
    this.openai = openai;
  }

  async suggestPlotTypes(data, headers) 
  {
    // Get 2 random sample rows for suggestions
    const sampleRows = getRandomSampleRows(data, [], 20);

    // Format samples for the suggestion prompt
    const formattedSamples = sampleRows.map((row, idx) => ({
      row: idx + 1,
      data: row
    }));

    // Create the suggestion prompt
    const suggestionPrompt = `Given this table structure:
Headers: ${JSON.stringify(headers)}
Random sample of data (showing 20 of ${data.length} total rows):
${JSON.stringify(formattedSamples, null, 2)}

Note: Your code will receive the ENTIRE dataset (${data.length} rows) as input, not just this sample.

Suggest 5 different meaningful visualizations that would provide insights about this data to the user.
For each visualization:
1. Focus on revealing patterns, trends, correlations, or distributions by understanding the input sample random dataset and understanding which would give good visulization here
2. Focus on generating more relevant graphs that can be understood easily by user and avoid too much complexity to avoid information paralysis
3. Prioritize visualizations that tell a story about the data
4. Include statistical insights where it would b really relevant (e.g., trend lines, averages, distributions)
5. Ensure the visualization adds unique value and properly spaced
6. Try to avoid heatmaps in general though do suggest if really helpful for data visualization and suggest at max 7 suggestions

Return the response in this format:
1. [Plot Type]: [Detailed insight-focused description]
2. [Plot Type]: [Detailed insight-focused description]
...etc`;

    try {
      const completion = await this.openai.chat.completions.create({
        messages: [
          { role: "system", content: "You are a data visualization expert." },
          { role: "user", content: suggestionPrompt }
        ],
        model: "gpt-4o-mini",
      });
      const suggestions = this.parseSuggestions(completion.choices[0].message.content);
      return suggestions;
    }
    catch (error) {
      throw new Error(`Failed to generate plot suggestions: ${error.message}`);
    }
  }

    
  async suggestPlots(data, headers) {

    try {
      const suggestions = await this.suggestPlotTypes(data, headers)
      return await this.generatePlots(suggestions, data);
    } catch (error) {
      throw new Error(`Failed to generate plot suggestions: ${error.message}`);
    }
  }

  parseSuggestions(content) {
    const suggestions = content.split('\n')
      .filter(line => line.match(/^\d+\./))
      .map(line => {
        const [plotType, description] = line.substring(3).split(':');
        return {
          plotType: plotType.trim(),
          description: description.trim()
        };
      });
    return suggestions.slice(0, 5); // Changed from 3 to 5
  }

  async generatePlots(suggestions, data) {
    const results = [];
    const plotDir = path.join(__dirname, 'plots');

    // // Ensure the plot directory exists
    // if (!fs.existsSync(plotDir)) {
    //   await fs.mkdir(plotDir);
    // }

    // Get 4 random rows for plotting
    const plotSampleRows = getRandomSampleRows(data, [], 10);
    let tries = 0;
    for (const suggestion of suggestions) {
      try {
        
        const plotPrompt = `Create a ${suggestion.plotType} visualization for the data.
The plot should be clear, informative, and properly labeled. The data should be correctly transformed for visual representation.
The axis should not just dole out the numbers, but they should be appropriately scaled and maintain the aspect ratio for visual clarity.
Create a visualization based on the user request. Create plots that actually help user understand the data, dont add unnecessary complexity to the plot. Keep note of the numerical values, and ensure quality plots with good data representation. Dont use flashy colors, relevant and graph related colors. Graph should somehow help user in identifying trends if possible and make the data come in a meaningful way in a sequential way. The numerical value should be represented in consistent way and not haphazard way and dont make too many assumption about the data.
For the data plot the: ${suggestion.description}

Use the following sample data (10 random rows):
${JSON.stringify(plotSampleRows, null, 2)}`;

        const completion = await this.openai.chat.completions.create({
          messages: [
            { role: "system", content: visualizationPrompt },
            { role: "user", content: plotPrompt }
          ],
          model: "gpt-4o-mini",
        });

        const pythonCode = completion.choices[0].message.content.replace(/```python\n|```\n|```/g, '').trim();
        const plot_html = await this.executePythonCode(pythonCode, data);

        // Save the plot HTML to a local file
        const plotFileName = `plot_${Date.now()}.html`;
        const plotFilePath = path.join(plotDir, plotFileName);
        await fs.writeFile(plotFilePath, plot_html, 'utf8');

        results.push({
          description: suggestion.description,
          plot_html: plot_html,
          code: pythonCode,
          filePath: plotFilePath // Include the file path in the results
        });
        tries += 1;
        
        if (tries == 3)
        {
          return results;
        }
      } catch (error) {
        console.error(`Error generating plot for ${suggestion.plotType}:`, error);
      }
    }

    return results;
  }

  async executePythonCode(pythonCode, data) {
    const tempDir = path.join(__dirname, 'temp');
    const plotsDir = path.join(__dirname, 'plots'); // Add plots directory
    const scriptPath = path.join(tempDir, `script_${Date.now()}.py`);
    const tempDataPath = path.join(tempDir, `data_${Date.now()}.json`);
    const plotPath = path.join(plotsDir, `plot_${Date.now()}.html`);
    let processedData = '';
    let errorData = '';

    try {
      // Ensure directories exist
      await fs.mkdir(tempDir, { recursive: true });
      await fs.mkdir(plotsDir, { recursive: true });

      console.log('Executing Python script:', {
        scriptPath,
        dataPath: tempDataPath,
        plotPath,
        dataSize: JSON.stringify(data).length
      });

      // Write the data to a temporary JSON file
      await fs.writeFile(tempDataPath, JSON.stringify(data), 'utf8');

      // Modify Python code to use specific plot path
      pythonCode = pythonCode.replace(
        "plot_path = 'plot.html'",
        `plot_path = '${plotPath.replace(/\\/g, '\\\\')}'`
      ).replace(
        'input_data = json.loads(sys.argv[1])',
        `with open("${tempDataPath.replace(/\\/g, '\\\\')}", 'r', encoding='utf-8') as f:
            input_data = json.load(f)`
      );

      // Write the Python code to a temporary file
      await fs.writeFile(scriptPath, pythonCode, 'utf8');

      // Execute Python script with proper error handling
      const pythonProcess = spawn('python', [scriptPath]);
      
      // Collect data from stdout and stderr
      pythonProcess.stdout.on('data', (data) => {
        processedData += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
      });

      // Wait for the process to complete
      const exitCode = await new Promise((resolve) => {
        pythonProcess.on('close', resolve);
      });

      if (exitCode !== 0 || errorData) {
        throw new Error(errorData || 'Python execution failed');
      }

      try {
        // Parse the output as JSON
        const sanitizedData = processedData.replace(/: NaN/g, ': "NaN"');
        const result = JSON.parse(sanitizedData);

        if (result.error) {
          throw new Error(result.error);
        }

        // Add debug logging for HTML content
        console.log('Plot HTML length:', result.plot_html?.length);
        console.log('Plot HTML preview:', result.plot_html?.substring(0, 200));

        return result.plot_html;
      } catch (parseError) {
        throw new Error(`Failed to parse Python output: ${parseError.message}`);
      }
    } catch (error) {
      console.error('Error executing Python code:', error);
      throw error;
    } finally {
      // Clean up temporary files
      try {
        await fs.unlink(scriptPath);
        await fs.unlink(tempDataPath);
      } catch (cleanupError) {
        console.error('Error cleaning up files:', cleanupError);
      }
    }
  }

  async *generatePlotsStream(data, suggestions) {
    try {
        // Get sample rows for suggestions
        const sampleRows = getRandomSampleRows(data, [], 10);

        let successfulPlotsCount = 0; // Counter for successful plots
        const maxPlots = 5; // Maximum number of plots to send

        // Generate plots one by one and yield them
        for (const suggestion of suggestions) {
            if (successfulPlotsCount >= maxPlots) {
                break; // Stop if we've reached the maximum number of successful plots
            }

            try {
                const plotPrompt = `Create a ${suggestion.plotType} visualization for the data.
                The plot should be clear, informative, and properly labeled. The data should be correctly transformed for visual representation.
                The axis should not just dole out the numbers, but they should be appropriately scaled and maintain the aspect ratio for visual clarity.
                Create a visualization based on the user request. Create plots that actually help user understand the data, dont add unnecessary complexity to the plot. Keep note of the numerical values, and ensure quality plots with good data representation. Dont use flashy colors, relevant and graph related colors. Graph should somehow help user in identifying trends if possible but importantly keeping the visualization simplistic and not too complex and make the data come in a meaningful way in a sequential way. The numerical value should be represented in consistent way and not haphazard way and dont make too many assumption about the data.
                For the data plot the: ${suggestion.description}
                
                Use the following sample data (10 random rows):
                ${JSON.stringify(sampleRows, null, 2)}`; // Get suggestions first

                const completion = await this.openai.chat.completions.create({
                    messages: [
                        { role: "system", content: visualizationPrompt },
                        { role: "user", content: plotPrompt }
                    ],
                    model: "gpt-4o-mini",
                });

                const pythonCode = completion.choices[0].message.content
                    .replace(/```python\n|```\n|```/g, '')
                    .trim();

                const plot_html = await this.executePythonCode(pythonCode, data);

                // Yield the successful plot
                successfulPlotsCount++; // Increment the successful plot counter
                yield {
                    description: suggestion.description,
                    plot_html: plot_html,
                    code: pythonCode
                };
            } catch (error) {
                console.error(`Error generating plot for ${suggestion.plotType}:`, error);
                // Do not yield error plots
            }
        }
    } catch (error) {
        console.error('Error in plot generation stream:', error);
        throw error;
    }
}
}

module.exports = PlotSuggestor; 