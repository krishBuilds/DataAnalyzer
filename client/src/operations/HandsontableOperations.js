export class HandsontableOperations {
    constructor() {
        this.data = [];
        this.headers = [];
        this.columns = [];
        this.selectedRows = new Set();
        this.changedRows = new Set();
        this.history = [];
        this.currentHistoryIndex = -1;
        this.editingCell = null;
        this.editingHeader = null;
        this.pageSize = 100;
        this.currentPage = 0;
        this.totalRows = 0;
    }

    getColumns() {
        return this.headers.map(header => ({
            data: header,
            title: header,
            width: 150,
            editor: 'text',
            type: 'text',
            wordWrap: false,
            className: 'htMiddle',
            readOnly: false,
            allowInvalid: false
        }));
    }

    getData() {
        return this.data;
    }

    getHeaders() {
        return this.headers;
    }

    getCurrentState() {
        return {
            data: JSON.parse(JSON.stringify(this.data)),
            headers: [...this.headers],
            selectedRows: new Set([...this.selectedRows]),
            changedRows: new Set([...this.changedRows])
        };
    }

    updateData(newData) {
        if (!newData) return false;
        this.data = JSON.parse(JSON.stringify(newData));
        if (newData.length > 0) {
            this.headers = Object.keys(newData[0]);
            this.columns = this.headers.map(header => ({ data: header }));
        }
        return true;
    }

    handleCellUpdate(row, prop, newValue) {
        if (this.data[row]) {
            this.data[row][prop] = newValue;
            this.changedRows.add(row);
            this.saveState();
        }
    }

    selectRows(indices) {
        this.selectedRows = new Set(indices);
    }

    getSelectedRows() {
        return Array.from(this.selectedRows);
    }

    clearSelection() {
        this.selectedRows.clear();
    }

    startEditingCell(row, col) {
        this.editingCell = { row, col };
    }

    stopEditingCell() {
        if (this.editingCell) {
            this.saveState();
        }
        this.editingCell = null;
    }

    startEditingHeader(index) {
        this.editingHeader = index;
    }

    stopEditingHeader() {
        this.editingHeader = null;
    }

    removeColumn(index) {
        const header = this.headers[index];
        this.headers = this.headers.filter((_, idx) => idx !== index);
        this.data = this.data.map(row => {
            const newRow = { ...row };
            delete newRow[header];
            return newRow;
        });
        this.saveState();
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

        this.updateData(response.data);

        if (response.changedRows) {
            this.changedRows = new Set(response.changedRows);
        }

        return {
            data: this.getData(),
            headers: this.getHeaders(),
            changedRows: Array.from(this.changedRows)
        };
    }

    getChangedRows() {
        return Array.from(this.changedRows);
    }

    saveState() {
        const state = this.getCurrentState();
        
        // Remove any future states if we're in the middle of the history
        if (this.currentHistoryIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentHistoryIndex + 1);
        }
        
        this.history.push(state);
        this.currentHistoryIndex++;
        return true;
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

    isEditing() {
        return this.editingCell !== null || this.editingHeader !== null;
    }

    hasChanges() {
        return this.changedRows.size > 0;
    }

    isChangedCell(rowIndex) {
        return this.changedRows.has(rowIndex);
    }

    isRowSelected(rowIndex) {
        return this.selectedRows.has(rowIndex);
    }

    exportToCSV() {
        const headers = this.headers.join(',');
        const rows = this.data.map(row => 
            this.headers.map(header => row[header]).join(',')
        );
        return [headers, ...rows].join('\n');
    }

    exportToXLSX() {
        return {
            headers: this.headers,
            data: this.data.map(row => 
                this.headers.map(header => row[header])
            )
        };
    }

    getDataChunk(page) {
        const start = page * this.pageSize;
        const end = start + this.pageSize;
        return this.data.slice(start, end);
    }

    clearData() {
        this.data = [];
        this.headers = [];
        this.columns = [];
        this.selectedRows = [];
        if (this.history) {
            this.history = [];
        }
        if (this.currentHistoryIndex !== undefined) {
            this.currentHistoryIndex = -1;
        }
    }

    reset() {
        this.data = [{empty: ''}];
        this.headers = [];
        this.columns = [];
        this.selectedRows = [];
        if (this.history) {
            this.history = [];
        }
        if (this.currentHistoryIndex !== undefined) {
            this.currentHistoryIndex = -1;
        }
    }
}