import * as XLSX from 'xlsx';

export const fileHandlers = {
  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          let data;
          if (file.name.endsWith('.csv')) {
            data = this.parseCSV(e.target.result);
          } else {
            const workbook = XLSX.read(e.target.result, { type: 'binary' });
            data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
          }
          resolve(data);
        } catch (error) {
          reject(error);
        }
      };

      if (file.name.endsWith('.csv')) {
        reader.readAsText(file);
      } else {
        reader.readAsBinaryString(file);
      }
    });
  },

  parseCSV(content) {
    const lines = content.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const values = line.split(',');
      return headers.reduce((obj, header, index) => {
        obj[header] = values[index]?.trim();
        return obj;
      }, {});
    });
  }
}; 