import axios from 'axios';

export class ChakraComponentGenerator {
  constructor() {
    // Configure axios defaults if needed
    this.api = axios.create({
      baseURL: process.env.VUE_APP_API_URL || 'http://localhost:3000',
      timeout: 1000000, // 30 second timeout
      headers: {
        'Content-Type': 'application/json',
      }
    });
  }

  async getSuggestions(data, analysis, config) {
    try {
      const response = await this.api.post('/api/dashboard/chakra-suggestions', {
        data,
        analysis,
        config,
      });

      return response.data;
    } catch (error) {
      console.error('Error getting Chakra suggestions:', error);
      // Return empty suggestions instead of throwing
      return { suggestions: [] };
    }
  }

  async generateComponents(data, suggestions, analysis) {
    try {
      const components = [];

      // Execute all component generations in parallel
      const componentPromises = suggestions.suggestions.map(suggestion =>
        this.processComponent(data, suggestion, analysis)
      );

      const results = await Promise.all(componentPromises);

      // Filter out null results and add valid components
      results.forEach(result => {
        if (result) {
          components.push(result);
        }
      });

      return components;
    } catch (error) {
      console.error('Error generating Chakra components:', error);
      // Return any successfully generated components instead of throwing
      return [];
    }
  }

  async processComponent(data, suggestion, analysis) {
    try {
      const response = await this.api.post('/api/dashboard/generate-chakra-component', {
        data,
        suggestion,
        analysis,
      });

      // Ensure the response includes proper formatting information
      const component = response.data;
      
      // Add default formatting if not present
      if (component.type === 'metric') {
        component.format = component.format || {};
        component.format.decimals = component.format.decimals || 0;
        component.format.style = component.format.style || 'decimal';
      }
      
      // Ensure proper alignment for tables
      if (component.type === 'table') {
        component.alignment = component.alignment || 
          new Array(component.headers.length).fill('left');
      }

      return component;
    } catch (error) {
      console.error('Error processing Chakra component:', error);
      return null;
    }
  }
} 