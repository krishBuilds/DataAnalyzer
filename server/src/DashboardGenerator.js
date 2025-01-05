const { OpenAI } = require('openai');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const USE_PERPLEXITY = process.env.USE_PERPLEXITY === 'false';

const methodPrompt = `You are a Bokeh visualization expert. Given the following base template and context, provide ONLY the two required method implementations: preprocess_data and create_visualization.

Base Template:
import pandas as pd
import numpy as np
from bokeh.plotting import figure
from bokeh.layouts import column, row, gridplot
from bokeh.models import ColumnDataSource, HoverTool, Panel, Tabs, Legend
from bokeh.embed import json_item
from bokeh.palettes import Spectral6
import json
import sys

class DashboardVisualizer:
    def __init__(self, data):
        self.df = pd.DataFrame(data)
        self.source = None
        self.preprocess_data()
    
    # First required method
    def preprocess_data(self):
        # Your preprocessing code here
        pass
        self.source = ColumnDataSource(self.df_processed)

    
    # Second required method
    def create_visualization(self, **kwargs):
        # Your visualization code here
        pass

if __name__ == "__main__":
    try:
        input_data = json.loads(sys.stdin.read())
        visualizer = DashboardVisualizer(input_data['data'])
        plot = visualizer.create_visualization(**input_data.get('config', {}))
        script, div = components(plot)
        print(json.dumps({
            'result': {
                'script': script,
                'div': div
            }
        }))
        sys.stdout.flush()
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.stdout.flush()

Data Analysis:
{analysis}

Visualization Request:
{description}

Sample Data:
{sampleData}

Requirements:
1. Return ONLY the two method implementations
2. preprocess_data should:
   - Handle missing values appropriately
   - Convert data types as needed
   - Create derived features if useful
   - Update self.df in place
   - Handle all error cases

3. create_visualization should:
   - Create appropriate Bokeh visualization
   - Add interactive features and tooltips
   - Use proper styling and colors
   - Return a Bokeh figure object
   - Handle all error cases
   - For best representation in the plot it shall create aesthetic plot with appropriate orientation and display of the text
   - Based on data analysis identify best way to represent information such as aggregating, clubbing extra values, growth etc and represent for better analysis
   - Enter correct input parameter names and syntax for Bokeh strictly 
   - Don't Use too many colors in the plot
   - Take care of the example error and avoid when wedging plot. RuntimeError: Expected start_angle, end_angle and fill_color to reference fields in the supplied data source 
   - Throw exception on error on catch if using try catch
   - Pass correct and vlaid attribute for plot related parameters
   - Use height and width attribute instead of plot_width and plot_height property here for plotting as they are incorrect attribute
   - Don't hallucinate methods and strictly generate code having correct associated syntax and attributes
   - Avoid the error and take care of color column correctly here. Error: Error in creating visualization: Color columns need to be of type uint32[N], uint8[N] or uint8/float
   
4. Use proper Python indentation and  Ensure all class methods are properly indented

5. Common Errors to Avoid:
   -nWhen a 'source' argument is passed to a glyph method, values that are sequences\n(like lists or arrays) must come from references to data columns in the source, so if using a list array for parameter like fill_color, the value shall come from the source itself, if necessary add the column in source in preprocess data method itself
   - Calculate all data values before creating ColumnDataSource
   - Always reference column names as strings when using source

Return format:
def preprocess_data(self):
    # Your preprocessing implementation

def create_visualization(self, **kwargs):
    # Your visualization implementation`;

class DashboardGenerator {
    constructor(openai) {
        this.openai = openai;
        this.baseTemplate = `
import pandas as pd
import numpy as np
from bokeh.plotting import figure
from bokeh.layouts import column, row, gridplot
from bokeh.models import ColumnDataSource, HoverTool, Panel, Tabs, Legend
from bokeh.embed import json_item, components
from bokeh.palettes import Spectral6
import json
import sys

class DashboardVisualizer:
    def __init__(self, data):
        self.df = pd.DataFrame(data)
        self.source = None
        self.preprocess_data()
    
    {methods}

if __name__ == "__main__":
    try:
        input_data = json.loads(sys.stdin.read())
        visualizer = DashboardVisualizer(input_data['data'])
        plot = visualizer.create_visualization(**input_data.get('config', {}))
        script, div = components(plot)
        print(json.dumps({
            'result': {
                'script': script,
                'div': div
            }
        }))
        sys.stdout.flush()
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.stdout.flush()
`;
    }

    async getVisualizationSuggestions(data, headers, analysis, config) {
        try {
            const prompt = `Based on the following data analysis, suggest visualization methods for a dashboard.
            Each suggestion should include a clear description and visualization type.
            
            Data Analysis:
            ${JSON.stringify(analysis, null, 2)}
            
            Data Headers: ${JSON.stringify(headers)}
            User Requirements:
            - Visualization Type: ${config.visualizationDesc || 'Any appropriate visualizations'}
            - Analysis Level: ${config.analysisLevel || 'basic'}
            - Theme: ${config.themeDesc || 'Default dark theme'}
            
            Focus on:
            1. Clear, meaningful visualizations that match the data types
            2. Interactive features where appropriate
            3. Proper error handling
            4. Consistent theme with dark background
            5. User-friendly tooltips and legends
            
            Return suggestions in format:
            {
              "suggestions": [
                {
                  "type": "visualization_type",
                  "description": "detailed description",
                  "priority": 1-10,
                  "config": {}
                }
              ]
            }`;

            const completion = await this.openai.chat.completions.create({
                messages: [
                    { role: "system", content: "You are a data visualization expert. Provide clear, practical visualization suggestions based on the data analysis." },
                    { role: "user", content: prompt }
                ],
                model: "gpt-4o-mini",
                temperature: 0.7
            });

            return JSON.parse(completion.choices[0].message.content.replace(/```json\n|```\n|```/g, '').trim());
        } catch (error) { 
            console.error('Error getting visualization suggestions:', error);
            throw new Error(`Failed to generate visualization suggestions: ${error.message}`);
        }
    }


    async generateMethods(suggestion, analysis, sampleData) {
        try {
            const prompt = methodPrompt
            .replace('{analysis}', JSON.stringify(analysis, null, 2))
            .replace('{description}', suggestion.description)
            .replace('{sampleData}', JSON.stringify(sampleData, null, 2));

            const prompt2 = `Based on the analysis and requirements, implement the following Bokeh visualization methods:
            - preprocess_data(): for data preparation
            - create_visualization(): for creating the Bokeh plot

            Requirements:
            - Use proper Python indentation (4 spaces)
            - Include error handling with try-except blocks
            - Ensure all class methods are properly indented
            - Return the visualization object and ensure correct bokeh syntax and visualization is done
            - Ensure there is no size mismatch due to diff column length and dont ccorrupt the data here and ensure correct attributes are passed for the bokeh plot
            - Pass inputs correctly especially to the component and give a plot that is error free and provides info about the data without having any error in the code
            - Try to avoid the error coming around bokeh plot generation "Input must be a Model, a Document, a Sequence of Models and Document, or a dictionary from string to Model and Document"

            Analysis: ${JSON.stringify(analysis, null, 2)}
            Description: ${suggestion.description}
            Sample Data: ${JSON.stringify(sampleData, null, 2)}`;

            const completion = await this.openai.chat.completions.create({
                messages: [
                    { 
                        role: "system", 
                        content: "You are a Bokeh visualization expert. Provide properly indented Python code with 4 spaces indentation. Ensure all class methods are correctly indented within the class." 
                    },
                    { role: "user", content: prompt }
                ],
                model: "gpt-4o-mini",
            });

            // Clean and format the Python code
            let pythonCode = completion.choices[0].message.content;
            pythonCode = pythonCode.replace(/```python\n|```\n|```/g, '').trim();
/*
            // Fix indentation and format code
            pythonCode = pythonCode.split('\n')
                .filter(line => line.trim()) // Remove empty lines
                .map(line => {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('class ')) {
                        return line.trimEnd(); // Keep class definition at root level
                    } else if (trimmed.startsWith('def ')) {
                        return '    ' + line.trimEnd(); // Indent methods with 4 spaces
                    } else if (trimmed.startsWith('try:') || trimmed.startsWith('except') || trimmed.startsWith('if ')) {
                        return '        ' + line.trimEnd(); // Indent control structures with 8 spaces
                    } else if (line.trim()) {
                        return '            ' + line.trimEnd(); // Indent code blocks with 12 spaces
                    }
                    return line;
                })
                .join('\n');

            // Validate the code structure
            if (!pythonCode.includes('def preprocess_data(self):') || 
                !pythonCode.includes('def create_visualization(self,')) {
                throw new Error('Generated code is missing required methods');
            }*/

            return pythonCode;
        } catch (error) {
            console.error('Error generating methods:', error);
            throw new Error(`Failed to generate visualization methods: ${error.message}`);
        }
    }

    async generateComponents(data, suggestions, analysis) {
        const components = [];
        const sampleData = this.getRandomSampleRows(data, [], 10);
        
        for (const suggestion of suggestions) {
            try {
                const methods = await this.generateMethods(suggestion, analysis, sampleData);
                const pythonCode = this.baseTemplate.replace('{methods}', methods);

                const result = await this.executePythonCode(pythonCode, {
                    data: data,
                    config: suggestion.config || {}
                });

                components.push({
                    type: suggestion.type,
                    priority: suggestion.priority,
                    description: suggestion.description,
                    content: {
                        script: result.script,
                        div: result.div,
                        fullHtmlPath: result.fullHtmlPath
                    }
                });
            } catch (error) {
                console.error(`Error generating component:`, error);
            }
        }
        
        return components.sort((a, b) => b.priority - a.priority);
    }

    getRandomSampleRows(data, selectedIndices = [], totalSamples = 10) {
        if (!data || !data.length) return [];
        
        const dataArray = Array.isArray(data) ? data : Object.values(data);
        return dataArray
            .map((row, idx) => ({
                ...row,
                _rowIndex: idx
            }))
            .sort(() => 0.5 - Math.random())
            .slice(0, Math.min(totalSamples, dataArray.length));
    }

    async executePythonCode(pythonCode, data) {
        const tempDir = path.join(__dirname, 'temp');
        const scriptPath = path.join(tempDir, `script_${Date.now()}.py`);
        const tempDataPath = path.join(tempDir, `data_${Date.now()}.json`);
        const htmlPath = path.join(tempDir, `bokeh_plot_${Date.now()}.html`);
        let processedData = '';
        let errorData = '';

        const bokehTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Bokeh Plot</title>
    <link rel="stylesheet" href="https://cdn.bokeh.org/bokeh/release/bokeh-3.6.2.min.css" type="text/css">
    <script src="https://cdn.bokeh.org/bokeh/release/bokeh-3.6.2.min.js"></script>
</head>
<body>
    <div id="bokeh-plot">
        {{div}}
    </div>
    {{script}}
</body>
</html>`;

        try {
            // Ensure temp directory exists
            await fs.mkdir(tempDir, { recursive: true });

            // Modify Python code to suppress warnings and handle errors better
            const modifiedPythonCode = `
import warnings
warnings.filterwarnings('ignore')
import pandas as pd
pd.options.mode.chained_assignment = None
${pythonCode}`;

            // Write the data to a temporary JSON file
            await fs.writeFile(tempDataPath, JSON.stringify(data), 'utf8');

            // Modify Python code to read from file instead of stdin
            const finalCode = modifiedPythonCode.replace(
                'input_data = json.loads(sys.stdin.read())',
                `with open("${tempDataPath.replace(/\\/g, '\\\\')}", 'r', encoding='utf-8') as f:
                    input_data = json.load(f)`
            );

            // Write the Python code to a temporary file
            await fs.writeFile(scriptPath, finalCode, 'utf8');

            // Execute Python script
            const pythonProcess = spawn('python', [scriptPath]);
            
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

            // Try to find valid JSON in the output
            let jsonMatch = processedData.match(/({[\s\S]*})/);
            if (!jsonMatch && exitCode !== 0) {
                throw new Error(errorData || 'Python execution failed');
            }

            try {
                const result = JSON.parse(jsonMatch ? jsonMatch[0] : processedData);
                if (result.error) {
                    throw new Error(result.error);
                }

                // Create complete HTML file using the template
                const completeHtml = bokehTemplate
                    .replace('{{div}}', result.result.div)
                    .replace('{{script}}', result.result.script);

                // Save the complete HTML file
                await fs.writeFile(htmlPath, completeHtml, 'utf8');

                // Return both the components and the full HTML file path
                return {
                    ...result.result,
                    fullHtmlPath: htmlPath
                };
            } catch (parseError) {
                console.error('Raw output:', processedData);
                console.error('Error data:', errorData);
                throw new Error(`Failed to parse Python output: ${parseError.message}`);
            }
        } catch (error) {
            console.error('Error executing Python code:', error);
            throw error;
        } finally {
            // Clean up temporary files except the HTML file
            try {
                await fs.unlink(scriptPath);
                await fs.unlink(tempDataPath);
            } catch (cleanupError) {
                console.error('Error cleaning up files:', cleanupError);
            }
        }
    }

    async getSuggestions(data, headers, config) {
        try {
            const { analysis } = config;
            
            const suggestions = await this.getAISuggestions(analysis, headers, sampleData, config);
            
            return {
                analysis,
                suggestions
            };
        } catch (error) {
            console.error('Error getting suggestions:', error);
            throw error;
        }
    }

    async generateVisualizations(data, suggestions, analysis, config) {
        try {
            const components = await this.generateComponents(data, suggestions, analysis);
            
            // Transform components to include Bokeh JSON
            const processedComponents = components.map(component => ({
                type: component.type,
                priority: component.priority,
                description: component.description,
                bokehJson: component.content
            }));

            return {
                components: processedComponents
            };
        } catch (error) {
            console.error('Error generating visualizations:', error);
            throw error;
        }
    }
}

module.exports = DashboardGenerator; 