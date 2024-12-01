export class RevoGridOperations {
    constructor() {
      this.data = [];
      this.headers = [];
      this.selectedRows = new Set();
      this.changedRows = new Set();
      this.history = [];
      this.currentHistoryIndex = -1;
    }
  
    getColumns() {
      return this.headers.map(header => ({
        prop: header,
        name: header,
        size: 150,
        cellTemplate: (h, props) => {
          return props.model[props.prop];
        }
      }));
    }
  
    getData() {
      return this.data;
    }
  
    getHeaders() {
      return this.headers;
    }
  
    updateData(newData) {
      if (!newData || !newData.length) return;
      
      this.saveState();
      
      // Extract headers from first row
      this.headers = Object.keys(newData[0]);
      
      // Transform data for RevoGrid
      this.data = newData.map((row, index) => ({
        ...row,
        __id: index // Add unique identifier
      }));
      
    }
  
    handleCellUpdate(rowId, prop, value) {
      const row = this.data.find(r => r.__id === rowId);
      if (row) {
        row[prop] = value;
      }
    }
  
    selectRows(indices) {
      this.selectedRows = new Set(indices);
    }
  
    getSelectedRows() {
      return Array.from(this.selectedRows);
    }
  
    getDataForServer() {
      return this.data.map(row => {
        const cleanRow = { ...row };
        delete cleanRow.__id;
        return cleanRow;
      });
    }
  
    updateFromServerResponse(response) {
        if (!response || !response.data) {
            throw new Error('Invalid server response');
        }

        // Update the data
        this.updateData(response.data);

        // Store changed rows if provided
        if (response.changedRows) {
            this.changedRows = new Set(response.changedRows);
        }

        return {
            data: this.getData(),
            headers: this.getHeaders(),
            changedRows: Array.from(this.changedRows || [])
        };
    }
  
    getChangedRows() {
        return Array.from(this.changedRows || []);
    }
  
    saveState() {
        // Remove future states if we're in the middle of history
        if (this.currentHistoryIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentHistoryIndex + 1);
        }
        
        // Save current state
        this.history.push({
            data: JSON.parse(JSON.stringify(this.data)),
            headers: [...this.headers],
            selectedRows: new Set([...this.selectedRows]),
            changedRows: new Set([...this.changedRows])
        });
        this.currentHistoryIndex++;
    }
  
    undo() {
        if (this.currentHistoryIndex > 0) {
            this.currentHistoryIndex--;
            const previousState = this.history[this.currentHistoryIndex];
            this.restoreState(previousState);
            return true;
        }
        return false;
    }
  
    redo() {
        if (this.currentHistoryIndex < this.history.length - 1) {
            this.currentHistoryIndex++;
            const nextState = this.history[this.currentHistoryIndex];
            this.restoreState(nextState);
            return true;
        }
        return false;
    }
  
    restoreState(state) {
        this.data = JSON.parse(JSON.stringify(state.data));
        this.headers = [...state.headers];
        this.selectedRows = new Set([...state.selectedRows]);
        this.changedRows = new Set([...state.changedRows]);
    }
  }