const LangModelRequestService = require('./services/LangModelRequestService');
const _ = require('lodash');

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
    constructor() {
        this.langModelService = new LangModelRequestService();
    }

    async getVisualizationSuggestions(data, headers, analysis, config) {
        try {
            const sampleData = this.getRandomSampleRows(data, [], 5);
            
            const systemPrompt = `
                You are a data visualization expert. Focus on:
                1. Generating 5-6 clear, meaningful visualizations that match the data types
                2. Providing 2-3 additional analyses (like growth rate calculations) that may not use Plotly
                3. Interactive features where appropriate
                4. Proper error handling and consistent data transformations with lodash
                5. A consistent theme (preferably a dark-based theme)
                6. User-friendly tooltips, legends, and textual analysis
                7. Employ creative but logical data manipulation to yield valuable insights
                8. Return ONLY valid JSON in the specified format and each JSON is independently treated
                9. Reference relevant parts of the previous analysis data and any important values
                10. Understand the data, what it might actually represent and recommend only relevant plots and don't recommend irrelevant ones based on understanding of the data here
            `;

            const userPrompt = `
                Based on the following data analysis and sample data, suggest visualizations and additional analyses for a dashboard.

                Data Analysis:
                ${JSON.stringify(analysis, null, 2)}

                Sample Data (5 rows):
                ${JSON.stringify(sampleData, null, 2)}

                Data Headers: ${JSON.stringify(headers)}

                User Requirements:
                - Visualization Type: ${config.visualizationDesc || 'Any appropriate visualizations'}
                - Analysis Level: ${config.analysisLevel || 'basic'}
                - Theme: ${config.themeDesc || 'Dark theme'}

                Please include:
                - 5-6 Plotly-based visualizations
                - 2-3 analyses that might not be Plotly-based (e.g., numeric insights such as growth rate)
                - Use lodash where necessary for data manipulation

                Return ONLY a valid JSON object in this exact format:
                {
                  "suggestions": [
                    {
                      "type": "visualization_type",
                      "description": "detailed description",
                      "priority": 1-10,
                      "config": {}
                    }
                  ]
                }
            `;

            const response = await this.langModelService.getVisualizationSuggestions(userPrompt, systemPrompt);
            
            // Validate JSON response
            try {
                const parsedResponse = JSON.parse(response.replace(/```json\n|```\n|```/g, '').trim());
                if (!parsedResponse.suggestions || !Array.isArray(parsedResponse.suggestions)) {
                    throw new Error('Invalid response format');
                }
                return parsedResponse;
            } catch (parseError) {
                console.error('Error parsing visualization suggestions:', parseError);
                throw new Error('Failed to parse visualization suggestions response');
            }
        } catch (error) {
            console.error('Error getting visualization suggestions:', error);
            throw new Error(`Failed to generate visualization suggestions: ${error.message}`);
        }
    }

    async generateMethods(suggestion, analysis, sampleData) {
        try {
            const systemPrompt = `
                You are a Plotly.js expert. Provide production-ready JavaScript code that:
                1. Produces 5-6 Plotly visualizations
                2. Includes at least 2 additional textual or numeric analyses (e.g., growth rate) that may not be Plotly-based
                3. Uses lodash extensively for data transformations
                4. Provides responsive, user-friendly design with proper error handling
                5. Uses a consistent dark theme and minimal color palette
                6. Avoids "Failed to generate visualization methods: Unexpected token 'const'"
                7. Ensures correct syntax and minimal extraneous tokens
            `;

            const userPrompt = visualizationPrompt
                .replace('{description}', JSON.stringify(suggestion, null, 2))
                .replace('{sampleData}', JSON.stringify(sampleData, null, 2));

            const response = await this.langModelService.generateVisualizationMethods(userPrompt, systemPrompt);
            const methodsCode = response.replace(/```javascript\n|```\n|```/g, '').trim();
            
            return eval(`(${methodsCode})`);
        } catch (error) {
            console.error('Error generating methods:', error);
            throw new Error(`Failed to generate visualization methods: ${error.message}`);
        }
    }

    async generateComponents(data, suggestions, analysis) {
        const components = [];
        const sampleData = this.getRandomSampleRows(data, [], 5);
        
        try {
            // Generate all methods in parallel
            const methodPromises = suggestions.map(suggestion => 
                this.generateMethods(suggestion, analysis, sampleData)
                    .then(methods => ({
                        methods,
                        suggestion,
                        success: true
                    }))
                    .catch(error => ({
                        error,
                        suggestion,
                        success: false
                    }))
            );

            // Wait for all promises to resolve
            const results = await Promise.all(methodPromises);

            // Process results and create components
            results.forEach(result => {
                if (result.success) {
                    try {
                        const processedData = result.methods.preprocessData(data);
                        const plotlyConfig = result.methods.createVisualization(processedData, result.suggestion.config || {});

                        components.push({
                            type: result.suggestion.type,
                            priority: result.suggestion.priority,
                            description: result.suggestion.description,
                            content: plotlyConfig
                        });
                    } catch (error) {
                        console.error(`Error processing component:`, error);
                    }
                } else {
                    console.error(`Error generating component for ${result.suggestion.type}:`, result.error);
                }
            });
            
            return components.sort((a, b) => b.priority - a.priority);
        } catch (error) {
            console.error('Error in parallel processing:', error);
            throw error;
        }
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