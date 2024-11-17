import sys
import json
import pandas as pd
import numpy as np

def apply_operation(df, operation, params=None):
    if operation == 'sort':
        column = params.get('column')
        ascending = params.get('ascending', True)
        return df.sort_values(by=column, ascending=ascending)
    
    elif operation == 'delete_row':
        index = params.get('index')
        return df.drop(index=index)
    
    elif operation == 'clean':
        # Basic cleaning operations
        df = df.dropna()  # Remove rows with missing values
        # Convert numeric columns to proper type
        for col in df.columns:
            if df[col].dtype == 'object':
                try:
                    df[col] = pd.to_numeric(df[col])
                except:
                    pass
        return df
    
    return df

def preprocess_data(data, operation=None, params=None):
    # Convert input to pandas DataFrame
    df = pd.DataFrame(data)
    
    if operation:
        df = apply_operation(df, operation, params)
    
    # Convert back to dictionary format
    result = {
        'data': df.to_dict('records'),
        'summary': df.describe().to_dict(),
        'missing_values': df.isnull().sum().to_dict()
    }
    
    return json.dumps(result)

if __name__ == "__main__":
    # Read input data and parameters from Node.js
    input_json = json.loads(sys.argv[1])
    data = input_json.get('data', [])
    operation = input_json.get('operation')
    params = input_json.get('params')
    
    # Process the data
    result = preprocess_data(data, operation, params)
    
    # Print output to be captured by Node.js
    print(result) 