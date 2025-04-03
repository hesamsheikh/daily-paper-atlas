// Force edge colors to match their target nodes
function forceEdgeColors() {
  console.log("Forcibly updating edge colors based on connection type");
  
  // Create a map of node IDs to node info for faster lookup
  let nodeInfo = {};
  let typeCounts = { paper: 0, author: 0, organization: 0, unknown: 0 };
  
  sigmaInstance.iterNodes(function(node) {
    // Make sure node type is properly set
    let nodeType = node.type || 'unknown';
    typeCounts[nodeType] = (typeCounts[nodeType] || 0) + 1;
    
    nodeInfo[node.id] = {
      color: node.color || '#aaa',
      type: nodeType
    };
  });
  
  console.log("Node type counts:", typeCounts);
  
  // Track edge coloring statistics
  let edgeStats = {
    total: 0,
    paperAuthor: 0,
    paperOrg: 0,
    other: 0
  };
  
  // Update all edge colors based on connection type
  sigmaInstance.iterEdges(function(edge) {
    edgeStats.total++;
    
    const sourceNode = nodeInfo[edge.source];
    const targetNode = nodeInfo[edge.target];
    
    if (!sourceNode || !targetNode) {
      console.log(`Could not find node info for edge ${edge.id}`);
      return;
    }
    
    // Add debugging output for specific paper-organization edges (limit to first few)
    if (edgeStats.total < 10 && 
        ((sourceNode.type === 'paper' && targetNode.type === 'organization') ||
         (sourceNode.type === 'organization' && targetNode.type === 'paper'))) {
      console.log(`DEBUG Edge ${edge.id}: ${sourceNode.type}(${edge.source}) -> ${targetNode.type}(${edge.target})`);
    }
    
    // Check if this is a paper-author connection
    if ((sourceNode.type === 'paper' && targetNode.type === 'author') ||
        (sourceNode.type === 'author' && targetNode.type === 'paper')) {
      
      edgeStats.paperAuthor++;
      // Use author color for the edge
      const authorNode = sourceNode.type === 'author' ? sourceNode : targetNode;
      edge.color = authorNode.color;
      
      // Debug for a few edges
      if (edgeStats.paperAuthor < 5) {
        console.log(`Paper-Author edge ${edge.id}: Using author color ${edge.color}`);
      }
    }
    // Check if this is a paper-organization connection
    else if ((sourceNode.type === 'paper' && targetNode.type === 'organization') ||
             (sourceNode.type === 'organization' && targetNode.type === 'paper')) {
      
      edgeStats.paperOrg++;
      // Use paper color for the edge
      const paperNode = sourceNode.type === 'paper' ? sourceNode : targetNode;
      const orgNode = sourceNode.type === 'organization' ? sourceNode : targetNode;
      
      // Debug every paper-org edge to verify correct mapping
      console.log(`Paper-Org edge ${edge.id}: Paper=${paperNode.type}(${edge.source === paperNode.id ? 'source' : 'target'}) color=${paperNode.color}, Org=${orgNode.type}(${edge.source === orgNode.id ? 'source' : 'target'}) color=${orgNode.color}`);
      
      // EXPLICITLY SET COLOR - Make very clear what we're setting
      const oldColor = edge.color;
      edge.color = paperNode.color;
      
      console.log(`  Set edge ${edge.id} color: ${oldColor} -> ${edge.color}`);
    }
    // For any other connection types
    else {
      edgeStats.other++;
      // Default to target color for all other connection types
      edge.color = targetNode.color;
      
      // Debug for a few "other" edges
      if (edgeStats.other < 5) {
        console.log(`Other edge ${edge.id}: Using target color ${edge.color}`);
      }
    }
  });
  
  // Force the refresh to apply changes
  sigmaInstance.refresh();
  
  console.log("Edge coloring stats:", edgeStats);
  console.log("Edge colors have been updated based on connection types");
  
  // Add debug check after redraw to verify edge colors
  setTimeout(() => {
    console.log("Verifying edge colors after redraw:");
    let colorCount = {};
    sigmaInstance.iterEdges(function(edge) {
      if (!colorCount[edge.color]) {
        colorCount[edge.color] = 0;
      }
      colorCount[edge.color]++;
    });
    console.log("Edge color counts:", colorCount);
  }, 100);
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
    
    console.log("Sigma mouse properties configured");
    
    // Add nodes and edges to sigma
    for (let i = 0; i < graph.nodes.length; i++) {
      let node = graph.nodes[i];
      sigmaInstance.addNode(node.id, {
        label: node.label || node.id,
        x: node.x || Math.random() * 100,
        y: node.y || Math.random() * 100,
        size: node.size || 1,
        color: node.color || (node.type && config.nodeTypes && config.nodeTypes[node.type] ? 
                  config.nodeTypes[node.type].color : nodeTypes[node.type]?.color || '#666'),
        type: node.type
      });
    }
    
    // First add all nodes, then add edges with colors matching their target nodes
    for (let i = 0; i < graph.edges.length; i++) {
      let edge = graph.edges[i];
      
      // Get source and target node info to determine edge color
      let sourceNode = null;
      let targetNode = null;
      let edgeColor = '#aaa';
      
      sigmaInstance.iterNodes(function(node) {
        if (node.id === edge.source) {
          sourceNode = {
            type: node.type || 'unknown',
            color: node.color || '#aaa'
          };
        }
        if (node.id === edge.target) {
          targetNode = {
            type: node.type || 'unknown',
            color: node.color || '#aaa'
          };
        }
      });
      
      if (sourceNode && targetNode) {
        // Paper-Author connection: use author color
        if ((sourceNode.type === 'paper' && targetNode.type === 'author') ||
            (sourceNode.type === 'author' && targetNode.type === 'paper')) {
          const authorNode = sourceNode.type === 'author' ? sourceNode : targetNode;
          edgeColor = authorNode.color;
        }
        // Paper-Organization connection: use paper color
        else if ((sourceNode.type === 'paper' && targetNode.type === 'organization') ||
                 (sourceNode.type === 'organization' && targetNode.type === 'paper')) {
          const paperNode = sourceNode.type === 'paper' ? sourceNode : targetNode;
          edgeColor = paperNode.color;
        }
        // Default to target color for all other connections
        else {
          edgeColor = targetNode.color;
        }
      }
      
      sigmaInstance.addEdge(edge.id, edge.source, edge.target, {
        size: edge.size || 1,
        color: edgeColor
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
      edgeColor: 'default',  // Use our custom edge colors instead of target node colors
      defaultEdgeColor: '#ccc'  // Default color for edges without explicit colors
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
    sigmaInstance.draw(2, 2, 2, 2);
    
    // Force apply node colors from config to override any hardcoded colors in the data
    forceNodeColorsFromConfig();
    
    // Force edge colors again after applying node colors
    forceEdgeColors();
    
    // Add debug call to check paper-organization edges
    setTimeout(() => {
      console.log("Running edge coloring debug check");
      debugPaperOrgEdges();
    }, 2000);
    
    console.log("Sigma instance created and configured:", sigmaInstance);
    
    // Initialize node colors and sizes by type
    applyNodeStyles();
    
    // Force edge colors again after applyNodeStyles
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
    
    // Update edge colors following the custom logic
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
        edge.color = authorNode.color;
      }
      // Paper-Organization connection: use paper color
      else if ((sourceNode.type === 'paper' && targetNode.type === 'organization') ||
               (sourceNode.type === 'organization' && targetNode.type === 'paper')) {
        const paperNode = sourceNode.type === 'paper' ? sourceNode : targetNode;
        edge.color = paperNode.color;
      }
      // Default to target color for all other connection types
      else {
        edge.color = targetNode.color;
      }
    });
    
    sigmaInstance.refresh();
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
  console.log("nodeActive called with id:", nodeId);
  
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
  
  console.log("Node found:", node);
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
  
  console.log("Neighbors found:", Object.keys(neighbors).length);
  
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
    console.log("Displaying attribute pane");
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
    
    console.log("Attribute pane updated with node details");
  } catch (e) {
    console.error("Error updating attribute pane:", e);
  }
}

// Reset display (used when clicking outside nodes or closing the panel)
function nodeNormal() {
  console.log("nodeNormal called");
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
    sigmaInstance.refresh();
    
    // Force edge colors to ensure they're correct after reset
    forceEdgeColors();
  }
} 