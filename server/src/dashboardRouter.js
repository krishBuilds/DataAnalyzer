const express = require('express');
const router = express.Router();
const PlotSuggestor = require('./PlotSuggestedGraphs');
const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const plotSuggestor = new PlotSuggestor(openai);

// Add error handling middleware
router.use((err, req, res, next) => {
  console.error('Dashboard Router Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Add logging middleware
router.use((req, res, next) => {
  console.log(`Dashboard API Request: ${req.method} ${req.path}`);
  next();
});

router.post('/generate-plots', async (req, res) => {
  try {
    const { data, headers, fileType } = req.body;
    
    if (!data || !headers) {
      return res.status(400).json({
        success: false,
        error: 'Missing required data or headers'
      });
    }

    // Additional data validation
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or empty data array'
      });
    }

    // Validate data structure
    const validData = data.every(row => {
      return typeof row === 'object' && row !== null && Object.keys(row).length > 0;
    });

    if (!validData) {
      return res.status(400).json({
        success: false,
        error: 'Invalid data structure detected'
      });
    }

    console.log('Received request to generate plots:', {
      dataLength: data.length,
      headers: headers,
      fileType: fileType
    });

    const plots = await plotSuggestor.suggestPlots(data, headers);
    
    if (!plots || plots.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'No plots were generated'
      });
    }

    // Verify plot HTML content
    const validPlots = plots.filter(plot => plot.plot_html && typeof plot.plot_html === 'string');
    
    if (validPlots.length === 0) {
      throw new Error('Generated plots contain no valid HTML');
    }

    console.log('Sending plots:', {
      count: validPlots.length,
      htmlLengths: validPlots.map(p => p.plot_html.length)
    });

    res.json({
      success: true,
      plots: validPlots.map(plot => ({
        plot_html: plot.plot_html,
        description: plot.description
      }))
    });

  } catch (error) {
    console.error('Error in generate-plots:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;