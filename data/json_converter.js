/**
 * JSON Format Converter
 * 
 * This script converts the graph.json file from its source format to the format
 * expected by the SigmaJS visualization library.
 */

// Load required modules
const fs = require('fs');
const path = require('path');

// File paths
const sourcePath = path.join(__dirname, 'graph.json');
const outputPath = path.join(__dirname, 'sigma_graph.json');

// Load config to access node type colors
let config;
try {
  config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config.json'), 'utf8'));
} catch (error) {
  console.error('Error loading config.json:', error);
  config = {
    nodeTypes: {
      paper: { color: '#FF9A00', size: 3 },
      author: { color: '#62D600', size: 5 },
      organization: { color: '#020AA7', size: 4 },
      unknown: { color: '#ff7f0e', size: 3 }
    }
  };
}

// Convert the graph JSON
function convertGraph() {
  try {
    // Read the source file
    const graphData = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    
    // Prepare the SigmaJS JSON structure
    const sigmaData = {
      nodes: [],
      edges: []
    };
    
    // Process nodes
    graphData.nodes.forEach(node => {
      // Extract node data
      const nodeType = node.attributes.type || 'unknown';
      const nodeColor = (nodeType && config.nodeTypes && config.nodeTypes[nodeType]) 
        ? config.nodeTypes[nodeType].color 
        : node.attributes.color || '#666';
      
      // Create node in SigmaJS format
      const sigmaNode = {
        id: node.key,
        label: node.attributes.label || node.key,
        x: node.attributes.x || 0,
        y: node.attributes.y || 0,
        size: node.attributes.size || 1,
        color: nodeColor,
        type: nodeType,
        attr: { colors: {} }
      };
      
      // Add type to colors attribute for filtering
      if (nodeType) {
        sigmaNode.attr.colors.type = nodeType;
      }
      
      // Add any additional attributes
      for (const [key, value] of Object.entries(node.attributes)) {
        if (!['label', 'x', 'y', 'size', 'color', 'type'].includes(key)) {
          sigmaNode[key] = value;
        }
      }
      
      sigmaData.nodes.push(sigmaNode);
    });
    
    // Process edges
    let edgeCount = 0;
    graphData.edges.forEach(edge => {
      // Create edge in SigmaJS format
      const sigmaEdge = {
        id: edge.key || `e${edgeCount++}`,
        source: edge.source,
        target: edge.target
      };
      
      // Add weight if available
      if (edge.attributes && edge.attributes.weight) {
        sigmaEdge.weight = edge.attributes.weight;
      }
      
      // Add label if available
      if (edge.attributes && edge.attributes.label) {
        sigmaEdge.label = edge.attributes.label;
      }
      
      sigmaData.edges.push(sigmaEdge);
    });
    
    // Write the converted data
    fs.writeFileSync(outputPath, JSON.stringify(sigmaData, null, 2));
    
    return true;
  } catch (error) {
    console.error('Error during conversion:', error);
    return false;
  }
}

// Execute the conversion
convertGraph();

// Export function for potential reuse
module.exports = { convertGraph }; 