const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class DataAnalyzer {
  constructor() {
    this.pythonScript = `
import pandas as pd
import numpy as np
import json
import sys

def convert_to_serializable(obj):
    if isinstance(obj, (np.int64, np.int32, np.int16, np.int8)):
        return int(obj)
    elif isinstance(obj, (np.float64, np.float32)):
        return float(obj)
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif isinstance(obj, (pd.Timestamp, pd.DatetimeIndex)):
        return str(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj

def analyze_dataframe(df):
    analysis_results = {}
    overall_stats = {
        'total_rows': int(len(df)),
        'total_columns': int(len(df.columns)),
        'total_missing_values': int(df.isnull().sum().sum())
    }
    
    for column in df.columns:
        column_data = df[column]
        column_analysis = {}
        
        # Basic stats for all columns
        column_analysis['missing_values'] = int(column_data.isnull().sum())
        column_analysis['unique_values'] = int(column_data.nunique())
        
        # Numerical analysis
        if pd.api.types.is_numeric_dtype(column_data):
            column_analysis['type'] = 'Numerical'
            column_analysis['mean'] = convert_to_serializable(column_data.mean()) if not pd.isna(column_data.mean()) else None
            column_analysis['median'] = convert_to_serializable(column_data.median()) if not pd.isna(column_data.median()) else None
            column_analysis['std_dev'] = convert_to_serializable(column_data.std()) if not pd.isna(column_data.std()) else None
            column_analysis['min'] = convert_to_serializable(column_data.min()) if not pd.isna(column_data.min()) else None
            column_analysis['max'] = convert_to_serializable(column_data.max()) if not pd.isna(column_data.max()) else None
            quartiles = column_data.quantile([0.25, 0.75])
            column_analysis['quartiles'] = [convert_to_serializable(q) for q in quartiles]
            
        # Categorical analysis
        elif pd.api.types.is_string_dtype(column_data):
            column_analysis['type'] = 'Categorical'
            value_counts = column_data.value_counts()
            column_analysis['most_common'] = {
                'value': str(value_counts.index[0]) if not value_counts.empty else None,
                'count': int(value_counts.iloc[0]) if not value_counts.empty else 0
            }
            column_analysis['least_common'] = {
                'value': str(value_counts.index[-1]) if not value_counts.empty else None,
                'count': int(value_counts.iloc[-1]) if not value_counts.empty else 0
            }
            
        # DateTime analysis
        elif pd.api.types.is_datetime64_any_dtype(column_data):
            column_analysis['type'] = 'DateTime'
            column_analysis['min_date'] = str(column_data.min())
            column_analysis['max_date'] = str(column_data.max())
            column_analysis['date_range'] = str(column_data.max() - column_data.min())
            
        else:
            column_analysis['type'] = 'Other'
        
        analysis_results[column] = column_analysis
    
    return {
        'overall_stats': overall_stats,
        'column_analysis': analysis_results
    }

def format_analysis_text(analysis):
    text = "Dataset Overview:\\n"
    overall = analysis['overall_stats']
    text += f"- Total Rows: {overall['total_rows']}\\n"
    text += f"- Total Columns: {overall['total_columns']}\\n"
    text += f"- Total Missing Values: {overall['total_missing_values']}\\n\\n"
    
    text += "Column Analysis:\\n"
    for col, stats in analysis['column_analysis'].items():
        text += f"\\n{col}:\\n"
        text += f"- Type: {stats['type']}\\n"
        text += f"- Missing Values: {stats['missing_values']}\\n"
        text += f"- Unique Values: {stats['unique_values']}\\n"
        
        if stats['type'] == 'Numerical':
            text += f"- Mean: {stats['mean']:.2f}\\n" if stats['mean'] is not None else "- Mean: N/A\\n"
            text += f"- Median: {stats['median']:.2f}\\n" if stats['median'] is not None else "- Median: N/A\\n"
            text += f"- Std Dev: {stats['std_dev']:.2f}\\n" if stats['std_dev'] is not None else "- Std Dev: N/A\\n"
            text += f"- Range: [{stats['min']:.2f} - {stats['max']:.2f}]\\n" if stats['min'] is not None else "- Range: N/A\\n"
            
        elif stats['type'] == 'Categorical':
            if stats['most_common']['value']:
                text += f"- Most Common: {stats['most_common']['value']} ({stats['most_common']['count']} occurrences)\\n"
            if stats['least_common']['value']:
                text += f"- Least Common: {stats['least_common']['value']} ({stats['least_common']['count']} occurrences)\\n"
                
        elif stats['type'] == 'DateTime':
            text += f"- Date Range: {stats['date_range']}\\n"
            text += f"- Earliest: {stats['min_date']}\\n"
            text += f"- Latest: {stats['max_date']}\\n"
    
    return text

if __name__ == "__main__":
    try:
        input_data = json.loads(sys.stdin.read())
        df = pd.DataFrame(input_data)
        analysis = analyze_dataframe(df)
        formatted_text = format_analysis_text(analysis)
        print(json.dumps({
            'analysis': formatted_text,
            'raw': analysis
        }, default=convert_to_serializable))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
`;
  }

  async analyzeData(data) {
    try {
      // Create temporary Python script file
      const scriptPath = path.join(__dirname, 'temp_analyzer.py');
      await fs.writeFile(scriptPath, this.pythonScript);

      return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', [scriptPath]);
        let outputData = '';
        let errorData = '';

        pythonProcess.stdout.on('data', (data) => {
          outputData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          errorData += data.toString();
        });

        pythonProcess.on('close', async (code) => {
          try {
            await fs.unlink(scriptPath);
            
            if (code !== 0) {
              reject(new Error(errorData || 'Analysis failed'));
              return;
            }

            const result = JSON.parse(outputData);
            if (result.error) {
              reject(new Error(result.error));
              return;
            }

            resolve(result);
          } catch (error) {
            reject(error);
          }
        });

        // Send data to Python script
        pythonProcess.stdin.write(JSON.stringify(data));
        pythonProcess.stdin.end();
      });
    } catch (error) {
      throw new Error(`Data analysis failed: ${error.message}`);
    }
  }
}

module.exports = DataAnalyzer; 