class ChatFlow {
  constructor() {
    this.flows = JSON.parse(localStorage.getItem('chatFlows')) || [];
    this.currentRecording = null;
    this.isRecording = false;
  }

  generateFlowName(fileName = null) {
    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\//g, '');
    
    return fileName ? 
      `${fileName.split('.')[0]}_${date}` : 
      `Flow_${date}_${this.flows.length + 1}`;
  }

  startRecording(fileName = null) {
    this.isRecording = true;
    this.currentRecording = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      messages: [],
      name: this.generateFlowName(fileName),
      fileName: fileName
    };
  }

  stopRecording() {
    if (this.isRecording && this.currentRecording) {
      try {
        this.flows.push(this.currentRecording);
        this.saveFlows();
      } catch (error) {
        console.error('Error stopping recording:', error);
      } finally {
        this.isRecording = false;
        this.currentRecording = null;
      }
    }
  }

  captureCurrentFlow(messages, fileName = null) {
    const cleanMessages = [];
    
    for (let i = 0; i < messages.length; i++) {
      const currentMsg = messages[i];
      const nextMsg = messages[i + 1];
      
      if (currentMsg.type === 'user') {
        if (nextMsg && nextMsg.type === 'bot' && !nextMsg.error) {
          cleanMessages.push({
            ...currentMsg,
            sampleData: currentMsg.sampleData || null
          });
          cleanMessages.push(nextMsg);
        }
        i++;
      }
    }

    const flow = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      messages: cleanMessages,
      name: this.generateFlowName(fileName),
      fileName: fileName
    };
    
    this.flows.push(flow);
    this.saveFlows();
    return flow;
  }

  recordMessage(message) {
    if (this.isRecording && this.currentRecording) {
      const messages = this.currentRecording.messages;
      const lastMessage = messages[messages.length - 1];
      
      if (message.type === 'user') {
        messages.push({
          ...message,
          sampleData: message.sampleData || null
        });
      } 
      else if (message.type === 'bot') {
        if (!message.error) {
          if (lastMessage && lastMessage.type === 'user') {
            messages.push(message);
          } else if (lastMessage && lastMessage.type === 'bot') {
            messages[messages.length - 1] = message;
          }
        } else {
          if (lastMessage && lastMessage.type === 'user') {
            messages.pop();
          }
        }
      }
      
      this.saveFlows();
    }
  }

  getAllFlows() {
    return this.flows;
  }

  getFlow(id) {
    return this.flows.find(flow => flow.id === id);
  }

  deleteFlow(id) {
    this.flows = this.flows.filter(flow => flow.id !== id);
    this.saveFlows();
  }

  saveFlows() {
    try {
      localStorage.setItem('chatFlows', JSON.stringify(this.flows));
    } catch (error) {
      console.error('Error saving flows:', error);
    }
  }

  renameFlow(id, newName) {
    const flow = this.flows.find(f => f.id === id);
    if (flow) {
      flow.name = newName;
      this.saveFlows();
    }
  }
}

export default new ChatFlow(); 