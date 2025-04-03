// Force edge colors to match their target nodes
function forceEdgeColors() {
  if (!sigmaInstance) return;
  
  // Create a map of node IDs to node info for faster lookup
  let nodeInfo = {};
  let nodeTypeCount = { paper: 0, author: 0, organization: 0, unknown: 0 };
  
  sigmaInstance.iterNodes(function(node) {
    // Log a few nodes to verify their properties
    if (nodeTypeCount[node.type || 'unknown'] < 3) {
      console.log(`Node ${node.id}: type=${node.type}, color=${node.color}`);
    }
    nodeTypeCount[node.type || 'unknown']++;
    
    nodeInfo[node.id] = {
      color: node.color || '#aaa',
      type: node.type || 'unknown'
    };
  });
  
  console.log("Node type counts:", nodeTypeCount);
  
  let edgeTypeCount = {
    paperAuthor: 0,
    paperOrg: 0,
    other: 0
  };
  
  // First pass: determine colors
  let edgeColors = {};
  sigmaInstance.iterEdges(function(edge) {
    const sourceNode = nodeInfo[edge.source];
    const targetNode = nodeInfo[edge.target];
    
    if (!sourceNode || !targetNode) {
      console.log(`Missing node info for edge ${edge.id}: source=${edge.source}, target=${edge.target}`);
      return;
    }
    
    let newColor;
    let edgeType = '';
    
    // Check if this is a paper-author connection
    if ((sourceNode.type === 'paper' && targetNode.type === 'author') ||
        (sourceNode.type === 'author' && targetNode.type === 'paper')) {
      edgeTypeCount.paperAuthor++;
      // Use author color for the edge
      const authorNode = sourceNode.type === 'author' ? sourceNode : targetNode;
      newColor = authorNode.color;
      edgeType = 'paper-author';
    }
    // Check if this is a paper-organization connection
    else if ((sourceNode.type === 'paper' && targetNode.type === 'organization') ||
             (sourceNode.type === 'organization' && targetNode.type === 'paper')) {
      edgeTypeCount.paperOrg++;
      // Use paper color for the edge
      const paperNode = sourceNode.type === 'paper' ? sourceNode : targetNode;
      newColor = paperNode.color;
      edgeType = 'paper-org';
    }
    // For any other connection types
    else {
      edgeTypeCount.other++;
      // Default to source color for all other connection types
      newColor = sourceNode.color;
      edgeType = 'other';
    }
    
    // Store the color to apply in the second pass
    edgeColors[edge.id] = {
      color: newColor,
      type: edgeType
    };
  });
  
  // Second pass: apply colors
  sigmaInstance.iterEdges(function(edge) {
    if (edgeColors[edge.id]) {
      const colorInfo = edgeColors[edge.id];
      edge.color = colorInfo.color;
      
      // Log a few edges of each type to verify coloring
      if (edgeTypeCount[colorInfo.type === 'paper-author' ? 'paperAuthor' : 
                       colorInfo.type === 'paper-org' ? 'paperOrg' : 'other'] <= 3) {
        console.log(`Edge ${edge.id} (${colorInfo.type}): color=${colorInfo.color}`);
      }
    }
  });
  
  console.log("Edge type counts:", edgeTypeCount);
  
  // Force a complete redraw to ensure colors are applied
  sigmaInstance.draw();
  
  // Additional refresh to ensure changes are visible
  setTimeout(() => {
    sigmaInstance.refresh();
  }, 50);
}

// Log node colors for debugging
function logNodeColors() {
  if (!sigmaInstance) return;
  
  console.log("Current node colors by type:");
  let typeColors = {};
  
  // Collect colors for each node type
  sigmaInstance.iterNodes(function(node) {
    if (node.type) {
      if (!typeColors[node.type]) {
        typeColors[node.type] = {
          configColor: (config.nodeTypes && config.nodeTypes[node.type]) 
                        ? config.nodeTypes[node.type].color 
                        : (nodeTypes[node.type] ? nodeTypes[node.type].color : 'none'),
          nodeCount: 0,
          colorCounts: {}
        };
      }
      
      typeColors[node.type].nodeCount++;
      
      if (!typeColors[node.type].colorCounts[node.color]) {
        typeColors[node.type].colorCounts[node.color] = 0;
      }
      typeColors[node.type].colorCounts[node.color]++;
    }
  });
  
  // Log the results
  for (const type in typeColors) {
    console.log(`Node type: ${type}`);
    console.log(`  Config color: ${typeColors[type].configColor}`);
    console.log(`  Node count: ${typeColors[type].nodeCount}`);
    console.log('  Actual colors used:');
    for (const color in typeColors[type].colorCounts) {
      console.log(`    ${color}: ${typeColors[type].colorCounts[color]} nodes`);
    }
  }
}

// Force apply node colors from config, overriding any colors in the data
function forceNodeColorsFromConfig() {
  console.log("Forcibly applying node colors from config settings");
  
  if (!sigmaInstance) {
    console.error("Cannot apply node colors, sigma instance not initialized");
    return;
  }
  
  // Use configured node types with fallback to default types
  let configNodeTypes = config.nodeTypes || nodeTypes;
  
  // Apply colors to all nodes based on their type
  sigmaInstance.iterNodes(function(node) {
    if (node.type && configNodeTypes[node.type]) {
      // Override the node color with the one from config
      const configColor = configNodeTypes[node.type].color;
      console.log(`Setting node ${node.id} color to ${configColor} based on type ${node.type}`);
      node.color = configColor;
      
      // Also set size if configured
      if (configNodeTypes[node.type].size) {
        node.size = configNodeTypes[node.type].size;
      }
    }
  });
  
  // Refresh the display
  sigmaInstance.refresh();
  
  // Also update edge colors to match their target nodes
  setTimeout(function() {
    forceEdgeColors();
    // Log node colors after setting them for verification
    logNodeColors();
  }, 100);
  
  console.log("Node colors have been forcibly applied from config");
}

// Debug function to check paper-organization edge coloring
function debugPaperOrgEdges() {
  console.log("Debugging paper-organization edge coloring");
  
  // Create a map of node IDs to node info for faster lookup
  let nodeInfo = {};
  sigmaInstance.iterNodes(function(node) {
    nodeInfo[node.id] = {
      color: node.color || '#aaa',
      type: node.type || 'unknown',
      label: node.label || node.id
    };
  });
  
  // Find and log all paper-organization edges
  let paperOrgEdges = [];
  sigmaInstance.iterEdges(function(edge) {
    const sourceNode = nodeInfo[edge.source];
    const targetNode = nodeInfo[edge.target];
    
    if (!sourceNode || !targetNode) return;
    
    // Check if this is a paper-organization connection
    if ((sourceNode.type === 'paper' && targetNode.type === 'organization') ||
        (sourceNode.type === 'organization' && targetNode.type === 'paper')) {
      
      const paperNode = sourceNode.type === 'paper' ? sourceNode : targetNode;
      const orgNode = sourceNode.type === 'organization' ? sourceNode : targetNode;
      
      paperOrgEdges.push({
        edgeId: edge.id,
        edgeColor: edge.color,
        paperNodeId: paperNode.id,
        paperNodeLabel: paperNode.label,
        paperNodeColor: paperNode.color,
        orgNodeId: orgNode.id,
        orgNodeLabel: orgNode.label,
        orgNodeColor: orgNode.color,
        edgeSourceIsOrg: sourceNode.type === 'organization'
      });
    }
  });
  
  console.log(`Found ${paperOrgEdges.length} paper-organization edges`);
  console.log("Sample of paper-organization edges:", paperOrgEdges.slice(0, 5));
  
  // Check if edges are colored correctly (should match paper color)
  let correctlyColored = 0;
  let incorrectlyColored = 0;
  
  for (const edge of paperOrgEdges) {
    if (edge.edgeColor === edge.paperNodeColor) {
      correctlyColored++;
    } else {
      incorrectlyColored++;
      console.log(`Incorrectly colored edge: ${edge.edgeId} (color: ${edge.edgeColor}, should be: ${edge.paperNodeColor})`);
    }
  }
  
  console.log(`Edge coloring stats: ${correctlyColored} correct, ${incorrectlyColored} incorrect`);
  
  return paperOrgEdges;
}

// Initialize the graph with the loaded data
function initializeGraph(data) {
  graph = data;
  console.log("Initializing graph with nodes:", graph.nodes.length, "edges:", graph.edges.length);
  
  try {
    // Initialize Sigma instance using the older sigma.init pattern
    sigmaInstance = sigma.init(document.getElementById('sigma-canvas'));
    
    // Configure mouse properties to ensure events work
    sigmaInstance.mouseProperties({
      maxRatio: 32,
      minRatio: 0.5,
      mouseEnabled: true,
      mouseInertia: 0.8
    });
    
    // Add nodes to sigma
    for (let i = 0; i < graph.nodes.length; i++) {
      let node = graph.nodes[i];
      
      // Ensure node type is set
      if (!node.type && node.id) {
        const idParts = node.id.split('_');
        if (idParts.length >= 2) {
          node.type = idParts[0];  // Extract type from ID (e.g., "paper_123" -> "paper")
        }
      }
      
      // Get color from config based on node type
      let nodeColor;
      if (node.type && config.nodeTypes && config.nodeTypes[node.type]) {
        nodeColor = config.nodeTypes[node.type].color;
      } else if (node.type && nodeTypes[node.type]) {
        nodeColor = nodeTypes[node.type].color;
      } else {
        nodeColor = '#666';
      }
      
      // Log node info for debugging
      if (i < 5) {
        console.log(`Adding node: id=${node.id}, type=${node.type}, color=${nodeColor}`);
      }
      
      sigmaInstance.addNode(node.id, {
        label: node.label || node.id,
        x: node.x || Math.random() * 100,
        y: node.y || Math.random() * 100,
        size: node.size || 1,
        color: nodeColor,
        type: node.type
      });
    }
    
    // First add all nodes, then add edges
    for (let i = 0; i < graph.edges.length; i++) {
      let edge = graph.edges[i];
      sigmaInstance.addEdge(edge.id, edge.source, edge.target, {
        size: edge.size || 1
      });
    }
    
    // Configure drawing properties
    sigmaInstance.drawingProperties({
      labelThreshold: config.sigma?.drawingProperties?.labelThreshold || 8,
      defaultLabelColor: config.sigma?.drawingProperties?.defaultLabelColor || '#000',
      defaultLabelSize: config.sigma?.drawingProperties?.defaultLabelSize || 14,
      defaultEdgeType: config.sigma?.drawingProperties?.defaultEdgeType || 'curve',
      defaultHoverLabelBGColor: config.sigma?.drawingProperties?.defaultHoverLabelBGColor || '#002147',
      defaultLabelHoverColor: config.sigma?.drawingProperties?.defaultLabelHoverColor || '#fff',
      borderSize: 2,
      nodeBorderColor: '#fff',
      defaultNodeBorderColor: '#fff',
      defaultNodeHoverColor: '#fff',
      edgeColor: 'source',  // Use source node colors by default, will be overridden by our custom colors
      defaultEdgeColor: '#ccc',  // Only used if no color is set
      minEdgeSize: 0.5,
      maxEdgeSize: 2
    });
    
    // Configure graph properties
    sigmaInstance.graphProperties({
      minNodeSize: config.sigma?.graphProperties?.minNodeSize || 1,
      maxNodeSize: config.sigma?.graphProperties?.maxNodeSize || 8,
      minEdgeSize: config.sigma?.graphProperties?.minEdgeSize || 0.5,
      maxEdgeSize: config.sigma?.graphProperties?.maxEdgeSize || 2,
      sideMargin: 50
    });
    
    // Force redraw and refresh
    sigmaInstance.draw();
    
    // Force apply node colors from config to override any hardcoded colors in the data
    forceNodeColorsFromConfig();
    
    // Initialize node colors and sizes by type
    applyNodeStyles();
    
    // Force edge colors one final time to ensure proper coloring
    forceEdgeColors();
    
    // Initialize filtering
    initFilters();
    
    // Bind events
    bindEvents();
  } catch (e) {
    console.error("Error initializing sigma instance:", e);
  }
}

// Apply node styles based on node type
function applyNodeStyles() {
  if (!sigmaInstance) return;
  try {
    // First update node colors
    sigmaInstance.iterNodes(function(node) {
      // Always use config colors for node types, ignoring any existing colors
      if (node.type && config.nodeTypes && config.nodeTypes[node.type]) {
        // Override with config color (even if node already has a color)
        node.color = config.nodeTypes[node.type].color;
        node.size = config.nodeTypes[node.type].size;
      } else if (node.type && nodeTypes[node.type]) {
        // Fallback to default colors
        node.color = nodeTypes[node.type].color;
        node.size = nodeTypes[node.type].size;
      }
    });
    
    // Force a redraw to ensure node colors are applied
    sigmaInstance.draw(2, 2, 2, 2);
    
    // Now update edge colors using forceEdgeColors
    forceEdgeColors();
  } catch (e) {
    console.error("Error applying node styles:", e);
  }
}

// Color nodes by attribute
function colorNodesByAttribute(attribute) {
  if (!sigmaInstance) return;
  
  console.log("Coloring nodes by attribute:", attribute);
  // Get all unique values for the attribute
  let values = {};
  let valueCount = 0;
  
  sigmaInstance.iterNodes(function(n) {
    let value = n[attribute] || 'unknown';
    if (!values[value]) {
      values[value] = true;
      valueCount++;
    }
  });
  
  // Assign colors to values
  let valueColors = {};
  let i = 0;
  let palette = config.colorPalette || colors;
  
  for (let value in values) {
    valueColors[value] = palette[i % palette.length];
    i++;
  }
  
  // Update node colors
  sigmaInstance.iterNodes(function(n) {
    let value = n[attribute] || 'unknown';
    n.originalColor = valueColors[value];
    n.color = valueColors[value];
  });
  
  // Create a map of node IDs to node info for faster lookup
  let nodeInfo = {};
  sigmaInstance.iterNodes(function(node) {
    nodeInfo[node.id] = {
      color: node.color || '#aaa',
      type: node.type || 'unknown'
    };
  });
  
  // Apply the custom edge coloring rules
  sigmaInstance.iterEdges(function(edge) {
    const sourceNode = nodeInfo[edge.source];
    const targetNode = nodeInfo[edge.target];
    
    if (!sourceNode || !targetNode) return;
    
    // Paper-Author connection: use author color
    if ((sourceNode.type === 'paper' && targetNode.type === 'author') ||
        (sourceNode.type === 'author' && targetNode.type === 'paper')) {
      const authorNode = sourceNode.type === 'author' ? sourceNode : targetNode;
      edge.originalColor = authorNode.color;
      edge.color = authorNode.color;
    }
    // Paper-Organization connection: use paper color
    else if ((sourceNode.type === 'paper' && targetNode.type === 'organization') ||
             (sourceNode.type === 'organization' && targetNode.type === 'paper')) {
      const paperNode = sourceNode.type === 'paper' ? sourceNode : targetNode;
      edge.originalColor = paperNode.color;
      edge.color = paperNode.color;
    }
    // Default to target color for all other connection types
    else {
      edge.originalColor = targetNode.color;
      edge.color = targetNode.color;
    }
  });
  
  sigmaInstance.refresh();
  
  // Update color legend
  updateColorLegend(valueColors);
}

// Display node details (used when a node is clicked)
function nodeActive(nodeId) {
  // Find the node
  var node = null;
  sigmaInstance.iterNodes(function(n) {
    if (n.id == nodeId) {
      node = n;
    }
  });
  
  if (!node) {
    console.error("Node not found:", nodeId);
    return;
  }
  
  sigmaInstance.detail = true;
  selectedNode = node;
  
  // Create a map of node IDs to node info for faster lookup
  let nodeInfo = {};
  sigmaInstance.iterNodes(function(n) {
    nodeInfo[n.id] = {
      color: n.color || '#aaa',
      type: n.type || 'unknown'
    };
  });
  
  // Find neighbors and store original edge colors
  var neighbors = {};
  sigmaInstance.iterEdges(function(e) {
    if (e.source == nodeId || e.target == nodeId) {
      neighbors[e.source == nodeId ? e.target : e.source] = {
        name: e.label || "",
        type: e.source == nodeId ? nodeInfo[e.target].type : nodeInfo[e.source].type,
        color: e.color
      };
      // Keep track of original edge color
      e.originalColor = e.color;
    }
  });
  
  // Update node appearance
  sigmaInstance.iterNodes(function(n) {
    if (n.id == nodeId) {
      n.originalColor = n.color;
      n.size = n.size * 1.5; // Emphasize selected node
    } else if (neighbors[n.id]) {
      n.originalColor = n.color;
    } else {
      n.originalColor = n.originalColor || n.color;
      n.color = greyColor;
    }
  });
  
  // Update edge appearance - grey out edges not connected to this node
  sigmaInstance.iterEdges(function(e) {
    if (e.source == nodeId || e.target == nodeId) {
      // Keep the edge's original color
      e.originalColor = e.color;
    } else {
      e.originalColor = e.originalColor || e.color;
      e.color = greyColor;
    }
  });
  
  // Refresh display
  sigmaInstance.refresh();
  
  // Populate connection list
  var connectionList = [];
  for (var id in neighbors) {
    var neighbor = null;
    sigmaInstance.iterNodes(function(n) {
      if (n.id == id) {
        neighbor = n;
      }
    });
    
    if (neighbor) {
      connectionList.push('<li><a href="#" data-node-id="' + id + '">' + (neighbor.label || id) + '</a></li>');
    }
  }
  
  // Show node details panel
  try {
    // Make absolutely sure the panel is visible with both CSS approaches
    $('#attributepane').show().css('display', 'block');
    
    // Update panel content
    $('.nodeattributes .name').text(node.label || node.id);
    
    let dataHTML = '';
    for (let attr in node) {
      if (attr !== 'id' && attr !== 'x' && attr !== 'y' && attr !== 'size' && attr !== 'color' && 
          attr !== 'label' && attr !== 'originalColor' && attr !== 'hidden' && 
          typeof node[attr] !== 'function' && attr !== 'displayX' && attr !== 'displayY' && 
          attr !== 'displaySize') {
        dataHTML += '<div><strong>' + attr + ':</strong> ' + node[attr] + '</div>';
      }
    }
    
    if (dataHTML === '') {
      dataHTML = '<div>No additional attributes</div>';
    }
    
    $('.nodeattributes .data').html(dataHTML);
    $('.nodeattributes .link ul').html(connectionList.length ? connectionList.join('') : '<li>No connections</li>');
    
    // Set up click event for neighbor nodes
    $('.nodeattributes .link ul li a').click(function(e) {
      e.preventDefault();
      var id = $(this).data('node-id');
      nodeActive(id);
    });
  } catch (e) {
    console.error("Error updating attribute pane:", e);
  }
}

// Reset display (used when clicking outside nodes or closing the panel)
function nodeNormal() {
  if (sigmaInstance) {
    sigmaInstance.detail = false;
    selectedNode = null;
    
    // Reset node appearance
    sigmaInstance.iterNodes(function(node) {
      node.color = node.originalColor || node.color;
      // Reset size to original
      if (node.type && config.nodeTypes && config.nodeTypes[node.type]) {
        node.size = config.nodeTypes[node.type].size;
      } else if (node.type && nodeTypes[node.type]) {
        node.size = nodeTypes[node.type].size;
      }
    });
    
    // Reset edge appearance
    sigmaInstance.iterEdges(function(edge) {
      edge.color = edge.originalColor || edge.color;
    });
    
    // Hide panel and refresh display
    $('#attributepane').css('display', 'none');
    
    // Force a complete redraw to ensure colors are properly applied
    sigmaInstance.draw(2, 2, 2, 2).refresh();
    
    // Force edge colors to ensure they're correct after reset
    forceEdgeColors();
  }
} 