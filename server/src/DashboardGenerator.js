const { OpenAI } = require('openai');
const _ = require('lodash');
//const dfd = require('danfojs');

const visualizationPrompt = `You are a Plotly.js visualization expert. Given the following data and context, understand the table and help user in creating meaningful plot as mentioned in the visualization request. Provide ONLY the JavaScript implementation for data preprocessing and visualization creation.

Requirements:
1. Return ONLY the two method implementations:
   - preprocessData: for data preparation
   - createVisualization: for creating the Plotly plot

2. preprocessData should:
   - Handle missing values appropriately
   - Convert data types as needed
   - Create derived features if useful
   - Use lodash for data manipulation (available as '_')
   - Return processed data

3. createVisualization should:
   - Create appropriate Plotly visualization
   - Add interactive features and tooltips
   - Use proper styling and colors
   - Return a Plotly figure configuration object
   - Handle all error cases
   - Create aesthetic plot with appropriate orientation
   - Based on data analysis, identify best way to represent information
   - Don't use too many colors in the plot
   - Ensure proper data type handling
   - Make the plot editable as true in the config (not layout)
   - Ensure no const related error comes
Sample Data:
{sampleData}

Visualization Request:
{description}

Available libraries:
- lodash (as '_')
- Plotly.js

Return format:
{
  preprocessData: function(data) {
    // Your preprocessing implementation using lodash
    // Return processed data ready for visualization
  },
  createVisualization: function(processedData, config) {
    // Your Plotly.js visualization implementation
    // Return Plotly configuration object
  }
}`;

class DashboardGenerator {
    constructor(openai) {
        this.openai = openai;
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
            const prompt = visualizationPrompt
                .replace('{description}', suggestion.description)
                .replace('{sampleData}', JSON.stringify(sampleData, null, 2));

            const completion = await this.openai.chat.completions.create({
                messages: [
                    { role: "system", content: "You are a Plotly.js visualization expert. Provide properly formatted JavaScript code." },
                    { role: "user", content: prompt }
                ],
                model: "gpt-4o-mini",
            });

            // Parse the response and evaluate it to get the methods
            const methodsCode = completion.choices[0].message.content
                .replace(/```javascript\n|```\n|```/g, '').trim();
            
            // Safely evaluate the code to get the methods object
            const methods = eval(`(${methodsCode})`);
            return methods;
        } catch (error) {
            console.error('Error generating methods:', error);
            throw new Error(`Failed to generate visualization methods: ${error.message}`);
        }
    }

    async generateComponents(data, suggestions, analysis) {
        const components = [];
        const sampleData = this.getRandomSampleRows(data, [], 5);
        
        for (const suggestion of suggestions) {
            try {
                const methods = await this.generateMethods(suggestion, analysis, sampleData);
                
                // Process the data
                const processedData = methods.preprocessData(data);
                
                // Create the visualization
                const plotlyConfig = methods.createVisualization(processedData, suggestion.config || {});

                components.push({
                    type: suggestion.type,
               
                    priority: suggestion.priority,
                    description: suggestion.description,
                    content: plotlyConfig
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

    async getSuggestions(data, headers, config) {
        try {
            const { analysis } = config;
            const suggestions = await this.getVisualizationSuggestions(analysis, headers, config);
            return { analysis, suggestions };
        } catch (error) {
            console.error('Error getting suggestions:', error);
            throw error;
        }
    }

    async generateVisualizations(data, suggestions, analysis, config) {
        try {
            const components = await this.generateComponents(data, suggestions, analysis);
            return { components };
        } catch (error) {
            console.error('Error generating visualizations:', error);
            throw error;
        }
    }
}

module.exports = DashboardGenerator; 