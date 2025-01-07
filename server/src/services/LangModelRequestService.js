const { OpenAI } = require('openai');

class LangModelRequestService {
    constructor(config = {}) {
        this.openai = new OpenAI();
        this.activeRequests = 0;
        this.maxConcurrentRequests = 8;
        this.requestQueue = [];
        this.retryDelay = config.retryDelay || 1000;
        this.maxRetries = config.maxRetries || 3;
    }

    async executeRequest(requestFn, retryCount = 0) {
        // Wait if we've hit the concurrent request limit
        while (this.activeRequests >= this.maxConcurrentRequests) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        try {
            this.activeRequests++;
            const result = await requestFn();
            this.activeRequests--;
            return result;
        } catch (error) {
            this.activeRequests--;
            if (retryCount < this.maxRetries && this.shouldRetry(error)) {
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this.executeRequest(requestFn, retryCount + 1);
            }
            throw error;
        }
    }

    shouldRetry(error) {
        return error.status === 429 || (error.status >= 500 && error.status < 600);
    }

    async getVisualizationSuggestions(prompt, systemPrompt) {
        return this.executeRequest(async () => {
            const completion = await this.openai.chat.completions.create({
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt }
                ],
                model: "gpt-4o-mini",
                temperature: 0.7
            });
            return completion.choices[0].message.content;
        });
    }

    async generateVisualizationMethods(prompt, systemPrompt) {
        return this.executeRequest(async () => {
            const completion = await this.openai.chat.completions.create({
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt }
                ],
                model: "gpt-4o-mini"
            });
            return completion.choices[0].message.content;
        });
    }
}

module.exports = LangModelRequestService; 