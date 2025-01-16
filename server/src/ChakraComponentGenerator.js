const LangModelRequestService = require('./services/LangModelRequestService');

class ChakraComponentGenerator {
    constructor() {
        this.langModelService = new LangModelRequestService();
    }

    async getChakraSuggestions(data, headers, analysis, config) {
        try {
            const sampleData = this.getRandomSampleRows(data, [], 12);
            const totalRows = data.length;
            
            const systemPrompt = `
                You are a data analysis expert focusing on key metrics and insights. Focus on:
                1. Generating 2-4 meaningful Chakra UI components that highlight key metrics
                2. Components should include metrics, lists, or small tables
                3. Each component should provide clear, actionable insights
                4. Focus on important statistical values, trends, or key findings
                5. Return ONLY valid JSON in the specified format
                6. Components should complement, not duplicate, the Plotly visualizations
                7. Identify patterns, anomalies, or significant data points
                8. Consider data types and relationships when suggesting metrics
            `;

            const userPrompt = `
                Based on the following data analysis and sample data, suggest Chakra UI components for key metrics and insights.

                Total Number of Rows in Dataset: ${totalRows}

                Data Analysis:
                ${JSON.stringify(analysis, null, 2)}

                Sample Data (12 rows out of ${totalRows} total rows):
                ${JSON.stringify(sampleData, null, 2)}

                Data Headers: ${JSON.stringify(headers)}

                User Requirements:
                - Analysis Level: ${config.analysisLevel || 'basic'}

                Return ONLY a valid JSON object in this exact format:
                {
                    "suggestions": [
                        {
                            "type": "metric|list|table",
                            "title": "component title",
                            "description": "detailed description",
                            "priority": 1-10,
                            "config": {}
                        }
                    ]
                }
            `;

            const response = await this.langModelService.getVisualizationSuggestions(userPrompt, systemPrompt);
            
            try {
                const parsedResponse = JSON.parse(response.replace(/```json\n|```\n|```/g, '').trim());
                if (!parsedResponse.suggestions || !Array.isArray(parsedResponse.suggestions)) {
                    throw new Error('Invalid response format');
                }
                return parsedResponse;
            } catch (parseError) {
                console.error('Error parsing Chakra suggestions:', parseError);
                return { suggestions: [] }; // Return empty suggestions instead of throwing
            }
        } catch (error) {
            console.error('Error getting Chakra suggestions:', error);
            return { suggestions: [] }; // Return empty suggestions on error
        }
    }

    async generateComponent(data, suggestion, analysis) {
        try {
            const systemPrompt = `
                You are a data analysis expert. Generate a Chakra UI component that:
                1. Provides clear, meaningful insights
                2. Uses appropriate formatting and styling
                3. Handles data types correctly
                4. Returns valid JSON in the specified format
                5. Includes proper error handling
                6. Return only the jsoin values here and nothing else to easily parse data
            `;

            const userPrompt = `
                Generate a Chakra UI component based on:

                Suggestion:
                ${JSON.stringify(suggestion, null, 2)}

                Analysis:
                ${JSON.stringify(analysis, null, 2)}

                Return a component configuration in this format:
                {
                    "type": "${suggestion.type}",
                    "title": "Component Title",
                    "value": "metric value", // for metric type
                    "label": "metric label", // for metric type
                    "change": { // optional, for metric type
                        "type": "positive|negative",
                        "value": "change value"
                    },
                    "items": [], // for list type
                    "headers": [], // for table type
                    "rows": [] // for table type
                }
            `;

            const response = await this.langModelService.generateVisualizationMethods(userPrompt, systemPrompt);
            return JSON.parse(response.replace(/```json\n|```\n|```/g, '').trim());
        } catch (error) {
            console.error('Error generating Chakra component:', error);
            return null; // Return null instead of throwing
        }
    }

    async generateComponents(data, suggestions, analysis) {
        const components = [];
        
        try {
            // Generate all components in parallel
            const componentPromises = suggestions.map(suggestion => 
                this.generateComponent(data, suggestion, analysis)
                    .then(component => component) // Return component or null
            );

            // Wait for all promises to resolve
            const results = await Promise.all(componentPromises);

            // Filter out null results and add valid components
            results.forEach(result => {
                if (result) {
                    components.push(result);
                }
            });
            
            return components;
        } catch (error) {
            console.error('Error in parallel processing:', error);
            return components; // Return any successfully generated components
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
}

module.exports = ChakraComponentGenerator; 