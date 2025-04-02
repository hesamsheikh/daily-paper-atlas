#!/usr/bin/env python
import json
import gzip
import xml.etree.ElementTree as ET
import sys
import os

def graphml_to_json(graphml_file, output_json, compressed_output=None):
    """
    Convert a GraphML file to SigmaJS-compatible JSON format
    """
    # Parse the GraphML file
    print(f"Parsing GraphML file: {graphml_file}")
    tree = ET.parse(graphml_file)
    root = tree.getroot()
    
    # Define the namespace
    ns = {'graphml': 'http://graphml.graphdrawing.org/xmlns'}
    
    # Extract the graph from the GraphML
    graph = root.find('graphml:graph', ns)
    
    if graph is None:
        # Try without namespace
        graph = root.find('graph')
        if graph is None:
            raise ValueError("Could not find graph element in GraphML file")
    
    # Prepare the JSON structure
    sigma_data = {
        'nodes': [],
        'edges': []
    }
    
    print("Processing nodes...")
    node_count = 0
    # Process nodes
    for node in graph.findall('graphml:node', ns) or graph.findall('node'):
        node_id = node.get('id')
        node_data = {'id': node_id, 'attr': {'colors': {}}}
        
        # Process node attributes
        for data in node.findall('graphml:data', ns) or node.findall('data'):
            key = data.get('key')
            if key == 'label':
                node_data['label'] = data.text
            elif key == 'x':
                node_data['x'] = float(data.text)
            elif key == 'y':
                node_data['y'] = float(data.text)
            elif key == 'size':
                node_data['size'] = float(data.text)
            elif key == 'r':
                # Find g and b values
                g_elem = node.find(f'graphml:data[@key="g"]', ns) or node.find(f'data[@key="g"]')
                b_elem = node.find(f'graphml:data[@key="b"]', ns) or node.find(f'data[@key="b"]')
                
                if g_elem is not None and b_elem is not None:
                    node_data['color'] = f"rgb({data.text},{g_elem.text},{b_elem.text})"
            elif key == 'type':
                node_data['attr']['colors']['type'] = data.text
                # Set a default color based on node type
                if data.text == 'author':
                    node_data['color'] = 'rgb(154,150,229)'
                elif data.text == 'paper':
                    node_data['color'] = 'rgb(229,150,154)'
                else:
                    node_data['color'] = 'rgb(150,229,154)'
        
        sigma_data['nodes'].append(node_data)
        node_count += 1
    
    print(f"Processed {node_count} nodes")
    
    print("Processing edges...")
    edge_count = 0
    # Process edges
    for edge in graph.findall('graphml:edge', ns) or graph.findall('edge'):
        source = edge.get('source')
        target = edge.get('target')
        
        edge_data = {
            'id': f"e{edge_count}",
            'source': source,
            'target': target
        }
        edge_count += 1
        
        # Process edge attributes
        for data in edge.findall('graphml:data', ns) or edge.findall('data'):
            key = data.get('key')
            if key == 'weight':
                edge_data['weight'] = float(data.text)
            elif key == 'edgelabel':
                edge_data['label'] = data.text
        
        sigma_data['edges'].append(edge_data)
    
    print(f"Processed {edge_count} edges")
    
    # Write the JSON file
    print(f"Writing JSON to {output_json}")
    with open(output_json, 'w') as f:
        json.dump(sigma_data, f)
    
    # If compressed output is requested, create a gzipped version
    if compressed_output:
        print(f"Creating compressed file: {compressed_output}")
        with open(output_json, 'rb') as f_in:
            data = f_in.read()
            # Write gzipped data with proper headers for web
            with gzip.open(compressed_output, 'wb', compresslevel=9) as f_out:
                f_out.write(data)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python graphml_to_json.py <input_graphml> <output_json> [compressed_output]")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    compressed_file = sys.argv[3] if len(sys.argv) > 3 else None
    
    try:
        graphml_to_json(input_file, output_file, compressed_file)
        print(f"Conversion completed. JSON saved to {output_file}")
        if compressed_file:
            print(f"Compressed version saved to {compressed_file}")
    except Exception as e:
        print(f"Error during conversion: {e}")
        sys.exit(1) 