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

router.post('/describe-data', async (req, res) => {
  const { data, headers } = req.body;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Transfer-Encoding', 'chunked');

  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'system',
        content: 'You are a data analyst. Analyze the given dataset and provide detailed insights in a clear, structured format.'
      }, {
        role: 'user',
        content: `Give a brief analysis of this dataset with headers: ${headers.join(', ')}. 
                 First 5 rows: ${JSON.stringify(data.slice(0, 5))}
                 Total rows: ${data.length}
                 
                 Provide a brief analysis of the data assuming user does not have any prior knowledge of the data.
                 1. Short summary on what data represents
                 2. Small overview of the data`
      }],
      stream: true,
      max_tokens: 250
    });

    let buffer = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        buffer += content;
        // Send complete sentences or paragraphs
        if (content.includes('.') || content.includes('\n')) {
          const dataChunk = JSON.stringify({ content: buffer }) + '\n';
          res.write(`data: ${dataChunk}\n`);
          buffer = ''; // Clear buffer after sending
          if (res.flush) res.flush();
        }
      }
    }
    
    // Send any remaining content in buffer
    if (buffer) {
      const dataChunk = JSON.stringify({ content: buffer }) + '\n';
      res.write(`data: ${dataChunk}\n`);
    }
    
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Error in data description:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

module.exports = router;