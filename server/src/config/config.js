const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

const requiredEnvVars = ['OPENAI_API_KEY'];

// Validate required environment variables
requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
        console.error(`ERROR: Required environment variable ${varName} is not set`);
        process.exit(1);
    }
});

const config = {
    port: process.env.PORT || 3000,
    openaiKey: process.env.OPENAI_API_KEY,
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:8080',
    nodeEnv: process.env.NODE_ENV || 'development',
};

module.exports = config; 