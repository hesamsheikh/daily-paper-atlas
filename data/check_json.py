#!/usr/bin/env python
import json
import gzip
import os

# File paths
json_file = 'paper_atlas_data.json'
compressed_file = 'paper_atlas_data.json.gz'

# Check if we need to decompress
if os.path.exists(compressed_file) and (not os.path.exists(json_file) or os.path.getsize(json_file) == 0):
    print(f"Decompressing {compressed_file} to {json_file}")
    with gzip.open(compressed_file, 'rb') as f_in:
        with open(json_file, 'wb') as f_out:
            f_out.write(f_in.read())

# Check if JSON file exists and has content
if not os.path.exists(json_file) or os.path.getsize(json_file) == 0:
    print(f"Error: {json_file} doesn't exist or is empty!")
    exit(1)

# Try to load the JSON data
try:
    with open(json_file, 'r') as f:
        data = json.load(f)
        
    # Check structure
    if 'nodes' not in data or 'edges' not in data:
        print("Error: JSON data doesn't have expected 'nodes' and 'edges' properties!")
        exit(1)
        
    # Add x,y coordinates to nodes that don't have them
    nodes_fixed = 0
    for node in data['nodes']:
        if 'x' not in node or 'y' not in node:
            # Assign random coordinates
            import random
            node['x'] = random.uniform(-10, 10)
            node['y'] = random.uniform(-10, 10)
            nodes_fixed += 1
    
    if nodes_fixed > 0:
        print(f"Fixed {nodes_fixed} nodes without coordinates")
        
        # Save the fixed JSON
        with open(json_file, 'w') as f:
            json.dump(data, f)
            
        # Update the compressed file
        with open(json_file, 'rb') as f_in:
            with gzip.open(compressed_file, 'wb') as f_out:
                f_out.write(f_in.read())
                
        print("Updated JSON files with fixes")
    
    print(f"JSON data is valid with {len(data['nodes'])} nodes and {len(data['edges'])} edges")
    
except json.JSONDecodeError as e:
    print(f"Error: Invalid JSON format: {e}")
    exit(1)
except Exception as e:
    print(f"Error: {e}")
    exit(1) 