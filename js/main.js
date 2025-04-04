// Global variables
let sigmaInstance;
let graph;
let filter;
let config = {};
let greyColor = '#ccc';
let selectedNode = null;
let colorAttributes = [];
let colors = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', 
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
];
let nodeTypes = {
  'paper': { color: '#2ca02c', size: 3 },
  'author': { color: '#9467bd', size: 5 },
  'organization': { color: '#1f77b4', size: 4 },
  'unknown': { color: '#ff7f0e', size: 3 }
};

// Initialize when document is ready
$(document).ready(function() {
  console.log("Document ready, initializing 🤗 Daily Papers Atlas");
  
  // Initialize attribute pane
  $('#attributepane').css('display', 'none');
  
  // Load configuration
  $.getJSON('config.json', function(data) {
    console.log("Configuration loaded:", data);
    config = data;
    document.title = config.text.title || 'Daily Papers Atlas';
    $('#title').text(config.text.title || 'Daily Papers Atlas');
    
    // Don't modify the intro text at all - using hardcoded HTML
    
    // Update the path to load data from the data folder
    if (config.data && !config.data.startsWith('data/')) {
      config.data = 'data/' + config.data;
    }
    
    // Initialize the edge color toggle after config is loaded
    $('#grey-edges-toggle').prop('checked', config.features?.useGreyEdges || false);
    
    loadGraph();
  }).fail(function(jqXHR, textStatus, errorThrown) {
    console.error("Failed to load config:", textStatus, errorThrown);
  });

  // Set up search functionality
  $('#search-input').on('input', function(e) {
    let searchTerm = $(this).val();
    if (searchTerm.length > 2) {
      searchNodes(searchTerm);
    } else {
      $('.results').empty();
    }
  });
  
  // Add functionality for Enter key in search
  $('#search-input').keypress(function(e) {
    if (e.which === 13) { // Enter key
      let searchTerm = $(this).val();
      if (searchTerm.length > 0) {
        searchNodes(searchTerm);
      }
    }
  });

  // Set up zoom buttons
  $('#zoom .z[rel="in"]').click(function() {
    if (sigmaInstance) {
      let a = sigmaInstance._core;
      sigmaInstance.zoomTo(a.domElements.nodes.width / 2, a.domElements.nodes.height / 2, a.mousecaptor.ratio * 1.5);
    }
  });
  
  $('#zoom .z[rel="out"]').click(function() {
    if (sigmaInstance) {
      let a = sigmaInstance._core;
      sigmaInstance.zoomTo(a.domElements.nodes.width / 2, a.domElements.nodes.height / 2, a.mousecaptor.ratio * 0.5);
    }
  });
  
  $('#zoom .z[rel="center"]').click(function() {
    if (sigmaInstance) {
      sigmaInstance.position(0, 0, 1).draw();
    }
  });

  // Set up attribute pane functionality
  $('.returntext').click(function() {
    nodeNormal();
  });

  // Set up filter selector
  $('#filter-select').change(function() {
    let filterValue = $(this).val();
    filterByNodeType(filterValue);
  });

  // Call updateLegend to ensure it runs
  setTimeout(function() {
    updateLegend();
  }, 500);
});

// Load graph data
function loadGraph() {
  console.log("Loading graph data from:", config.data);
  
  // Check if data is a .gz file and needs decompression
  if (config.data && config.data.endsWith('.gz')) {
    console.log("Compressed data detected, loading via fetch and pako");
    
    fetch(config.data)
      .then(response => response.arrayBuffer())
      .then(arrayBuffer => {
        try {
          // Decompress the gzipped data
          const uint8Array = new Uint8Array(arrayBuffer);
          const decompressed = pako.inflate(uint8Array, { to: 'string' });
          
          // Parse the JSON data
          const data = JSON.parse(decompressed);
          console.log("Graph data decompressed and parsed successfully");
          initializeGraph(data);
        } catch (error) {
          console.error("Error decompressing data:", error);
        }
      })
      .catch(error => {
        console.error("Error fetching compressed data:", error);
      });
  } else {
    // Load uncompressed JSON directly
    $.getJSON(config.data, function(data) {
      console.log("Graph data loaded successfully");
      initializeGraph(data);
    }).fail(function(jqXHR, textStatus, errorThrown) {
      console.error("Failed to load graph data:", textStatus, errorThrown);
      alert('Failed to load graph data. Please check the console for more details.');
    });
  }
}

// Initialize the graph with the loaded data
function initializeGraph(data) {
  graph = data;
  console.log("Initializing graph with nodes:", graph.nodes.length, "edges:", graph.edges.length);
  
  try {
    // Initialize Sigma instance using the older sigma.init pattern
    sigmaInstance = sigma.init(document.getElementById('sigma-canvas'));
    
    console.log("Sigma instance created:", sigmaInstance);
    
    if (!sigmaInstance) {
      console.error("Failed to create sigma instance");
      return;
    }
    
    // Configure mouse properties to ensure events work
    sigmaInstance.mouseProperties({
      maxRatio: 32,
      minRatio: 0.5,
      mouseEnabled: true,
      mouseInertia: 0.8
    });
    
    console.log("Sigma mouse properties configured");
    
    // Add nodes to the graph
    console.log("Adding nodes to sigma instance...");
    for (let i = 0; i < graph.nodes.length; i++) {
      let node = graph.nodes[i];
      
      // Try to detect node type if not already set
      if (!node.type && node.id && node.id.includes('_')) {
        const idParts = node.id.split('_');
        if (idParts.length >= 2 && ['paper', 'author', 'organization'].includes(idParts[0])) {
          node.type = idParts[0];
          console.log(`Detected type from ID: ${node.id} → ${node.type}`);
        }
      }
      
      let nodeColor = node.color || (node.type && config.nodeTypes && config.nodeTypes[node.type] ? 
                      config.nodeTypes[node.type].color : nodeTypes[node.type]?.color || '#666');
      
      sigmaInstance.addNode(node.id, {
        label: node.label || node.id,
        x: node.x || Math.random() * 100,
        y: node.y || Math.random() * 100,
        size: node.size || 1,
        color: nodeColor,
        type: node.type
      });
      
      // Debug output for a few nodes to verify type is set
      if (i < 3) {
        console.log("Added node:", node.id, "with type:", node.type);
      }
    }
    
    // Add edges to the graph
    console.log("Adding edges to sigma instance...");
    for (let i = 0; i < graph.edges.length; i++) {
      let edge = graph.edges[i];
      sigmaInstance.addEdge(edge.id, edge.source, edge.target, {
        size: edge.size || 1
        // Don't set edge color here - let the drawing properties handle it
      });
    }
    
    // Configure drawing properties
    sigmaInstance.drawingProperties({
      labelThreshold: 3000, // Set to a high value to hide all labels by default
      defaultLabelColor: config.sigma?.drawingProperties?.defaultLabelColor || '#000',
      defaultLabelSize: config.sigma?.drawingProperties?.defaultLabelSize || 14,
      defaultEdgeType: config.sigma?.drawingProperties?.defaultEdgeType || 'curve',
      defaultHoverLabelBGColor: config.sigma?.drawingProperties?.defaultHoverLabelBGColor || '#002147',
      defaultLabelHoverColor: config.sigma?.drawingProperties?.defaultLabelHoverColor || '#fff',
      borderSize: 2,
      nodeBorderColor: '#fff',
      defaultNodeBorderColor: '#fff',
      defaultNodeHoverColor: '#fff',
      edgeColor: 'default', // Always use solid grey edges
      defaultEdgeColor: '#ccc'
    });
    
    console.log("Edge color mode: solid grey");
    
    // Configure graph properties
    sigmaInstance.graphProperties({
      minNodeSize: config.sigma?.graphProperties?.minNodeSize || 1,
      maxNodeSize: config.sigma?.graphProperties?.maxNodeSize || 8,
      minEdgeSize: config.sigma?.graphProperties?.minEdgeSize || 0.5,
      maxEdgeSize: config.sigma?.graphProperties?.maxEdgeSize || 2
    });
    
    // Force initial rendering
    sigmaInstance.draw();
    
    console.log("Graph data loaded into sigma instance");
    
    // Initialize filters
    initFilters();
    
    // Update the legend
    updateLegend();
    
    // Bind events
    bindEvents();
    
    console.log("Graph initialization complete");
    
  } catch (e) {
    console.error("Error in initializeGraph:", e, e.stack);
  }
}

// Apply node styles based on node type
function applyNodeStyles() {
  if (!sigmaInstance) return;
  try {
    // First update node colors
    sigmaInstance.iterNodes(function(node) {
      if (node.type && config.nodeTypes && config.nodeTypes[node.type]) {
        node.color = config.nodeTypes[node.type].color;
        node.size = config.nodeTypes[node.type].size;
      } else if (node.type && nodeTypes[node.type]) {
        node.color = nodeTypes[node.type].color;
        node.size = nodeTypes[node.type].size;
      }
    });
    
    // Ensure edges match the target node colors by redrawing
    sigmaInstance.refresh();
  } catch (e) {
    console.error("Error applying node styles:", e);
  }
}

// Initialize filters
function initFilters() {
  try {
    if (sigma.plugins && sigma.plugins.filter) {
      filter = new sigma.plugins.filter(sigmaInstance);
      console.log("Filter plugin initialized");
    } else {
      console.warn("Sigma filter plugin not available");
    }
  } catch (e) {
    console.error("Error initializing filter plugin:", e);
  }
}

// Filter nodes by type
function filterByNodeType(filterValue) {
  if (!filter) return;
  try {
    filter.undo('node-type');
    
    if (filterValue === 'papers') {
      filter.nodesBy(function(n) {
        return n.type === 'paper';
      }, 'node-type');
    } else if (filterValue === 'authors') {
      filter.nodesBy(function(n) {
        return n.type === 'author';
      }, 'node-type');
    }
    
    filter.apply();
    sigmaInstance.refresh();
  } catch (e) {
    console.error("Error filtering nodes:", e);
  }
}

// Bind events based on the Model-Atlas implementation
function bindEvents() {
  if (!sigmaInstance) {
    console.error("Sigma instance not found when binding events");
    return;
  }
  
  console.log("Binding events to sigma instance");
  
  // When a node is clicked, display its details
  sigmaInstance.bind('upnodes', function(event) {
    console.log("Node clicked event fired:", event);
    if (event.content && event.content.length > 0) {
      var nodeId = event.content[0];
      console.log("Processing node click for node:", nodeId);
      // Set a flag to indicate we're processing a node click
      sigmaInstance.isMouseDown = true;
      // Call nodeActive with a slight delay to ensure event handling is complete
      setTimeout(function() {
        nodeActive(nodeId);
        // Reset the flag after processing
        setTimeout(function() {
          sigmaInstance.isMouseDown = false;
        }, 10);
      }, 10);
    }
  });
  
  // Show label when hovering over a node
  sigmaInstance.bind('overnodes', function(event) {
    if (event.content && event.content.length > 0) {
      var nodeId = event.content[0];
      
      sigmaInstance.iterNodes(function(n) {
        if (n.id === nodeId) {
          // Allow hover label to appear for any node being hovered over
          n.forceLabel = true;
          
          // But in detail view, don't allow this to override the selected node's neighbors
          if (sigmaInstance.detail && selectedNode && n.id !== selectedNode.id) {
            // Store the hover state to know we need to reset this node specifically
            n.attr = n.attr || {};
            n.attr.isHovered = true;
          }
        }
      });
      
      sigmaInstance.draw(2, 2, 2, 2);
    }
  });
  
  // Hide label when mouse leaves the node
  sigmaInstance.bind('outnodes', function(event) {
    // Handle nodes that were being hovered over
    if (event.content && event.content.length > 0) {
      var nodeId = event.content[0];
      
      sigmaInstance.iterNodes(function(n) {
        if (n.id === nodeId) {
          // Remove hover flag
          if (n.attr && n.attr.isHovered) {
            delete n.attr.isHovered;
          }
          
          // In detail view, only the selected node should keep its label
          if (sigmaInstance.detail) {
            if (selectedNode && n.id !== selectedNode.id) {
              n.forceLabel = false;
            }
          } else {
            // In normal view, always hide the label when hover ends
            n.forceLabel = false;
          }
        }
      });
    }
    
    sigmaInstance.draw(2, 2, 2, 2);
  });
  
  // When stage is clicked, close the attribute pane
  document.getElementById('sigma-canvas').addEventListener('click', function(evt) {
    // If we're in detail view and didn't click on a node, return to full graph
    if (sigmaInstance.detail && !sigmaInstance.isMouseDown) {
      // Give priority to node click events by waiting
      setTimeout(function() {
        // Only proceed if isMouseDown is still false after the delay
        if (!sigmaInstance.isMouseDown) {
          console.log("Canvas clicked while in detail view - returning to full view");
          nodeNormal();
        }
      }, 100);
    }
  });
}

// Display node details - without color changes
function nodeActive(nodeId) {
  console.log("nodeActive called with id:", nodeId);
  
  if (!sigmaInstance) {
    console.error("Sigma instance not ready for nodeActive");
    return;
  }
  
  if (sigmaInstance.detail && selectedNode && selectedNode.id === nodeId) {
    // Already active, no need to redraw
    return;
  }
  
  // Reset previous selection if any
  nodeNormal();
  
  // Find the selected node
  var selected = null;
  sigmaInstance.iterNodes(function(n) {
    if (n.id == nodeId) {
      selected = n;
    }
  });
  
  if (!selected) {
    console.error("Node not found:", nodeId);
    return;
  }
  
  // Debug: Log the structure of the selected node to understand available properties
  console.log("Selected node structure:", selected);
  if (selected.id && selected.id.includes('_')) {
    console.log("ID parts:", selected.id.split('_'));
  }
  console.log("Node type from property:", selected.type);
  console.log("Node color:", selected.color);
  
  // Mark as in detail view
  sigmaInstance.detail = true;
  
  // Store reference to selected node
  selectedNode = selected;
  
  // Find neighbors
  var neighbors = {};
  sigmaInstance.iterEdges(function(e) {
    if (e.source == nodeId || e.target == nodeId) {
      // Get ID of the neighbor node
      const neighborId = e.source == nodeId ? e.target : e.source;
      // Initialize the neighbor object if it doesn't exist
      neighbors[neighborId] = neighbors[neighborId] || {};
      // Store edge information if needed
      neighbors[neighborId].edgeLabel = e.label || "";
      neighbors[neighborId].edgeColor = e.color;
    }
  });
  
  // In Sigma.js v0.1, we need to use a different approach for focus
  // Store original colors for all nodes and edges
  sigmaInstance.iterNodes(function(n) {
    n.attr = n.attr || {};
    n.attr.originalColor = n.color;
    
    // Store original forceLabel state
    n.attr.originalForceLabel = n.forceLabel;
    
    if (n.id === nodeId) {
      // Make selected node slightly larger based on config
      n.attr.originalSize = n.size;
      const sizeFactor = config.highlighting?.selectedNodeSizeFactor ?? 1.5;
      n.size = n.size * sizeFactor;
      // Force label to show for selected node
      n.forceLabel = true;
    } else if (neighbors[n.id]) {
      // Do not show labels for neighbors, only keep them visible
      n.forceLabel = false;
    } else if (!neighbors[n.id]) {
      // For non-neighbor nodes, we use a custom attribute to track they should be dimmed
      // (Sigma v0.1 doesn't support opacity directly)
      n.attr.dimmed = true;
      // Apply a transparent version of the original color using configured opacity
      var rgb = getRGBColor(n.color);
      const opacity = config.highlighting?.nodeOpacity ?? 0.2;
      n.color = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + opacity + ')';
      // Hide labels for non-neighbor nodes
      n.forceLabel = false;
    }
  });
  
  // Apply the same to edges
  let debugCounts = { connected: 0, notConnected: 0 };
  let edgeCount = 0;
  
  console.log("Starting edge processing for node:", nodeId);
  
  sigmaInstance.iterEdges(function(e) {
    edgeCount++;
    e.attr = e.attr || {};
    
    // First, ensure we store the original color (only once)
    if (typeof e.attr.originalColor === 'undefined') {
      e.attr.originalColor = e.color;
      // console.log("Storing original color for edge:", e.id, "Color:", e.color);
    }
    
    // Store original size for edges (only once)
    if (typeof e.attr.originalSize === 'undefined') {
      e.attr.originalSize = e.size || 1;
    }
    
    // Get the actual source and target IDs from the edge
    let sourceId, targetId;
    
    // Handle source ID extraction
    if (typeof e.source === 'object' && e.source !== null) {
      sourceId = e.source.id;
    } else {
      sourceId = String(e.source);
    }
    
    // Handle target ID extraction
    if (typeof e.target === 'object' && e.target !== null) {
      targetId = e.target.id;
    } else {
      targetId = String(e.target);
    }
    
    // For safe comparison, convert nodeId to string as well
    const selectedNodeId = String(nodeId);
    
    // Check if this edge is connected to the selected node
    const isConnected = (sourceId === selectedNodeId || targetId === selectedNodeId);
    
    // Track counts for debugging
    if (isConnected) {
      debugCounts.connected++;
    } else {
      debugCounts.notConnected++;
    }
    
    // Apply different styles based on connection status
    if (isConnected) {
      // For connected edges, keep their original color and just increase size
      const sizeFactor = config.highlighting?.highlightedEdgeSizeFactor ?? 2;
      e.size = (e.attr.originalSize) * sizeFactor;
      // Don't change the color property at all - preserve exactly as is
      // console.log("Edge connected to selected node:", e.id, "Source:", sourceId, "Target:", targetId, "Keeping original color");
    } else {
      // For non-connected edges, use a very light gray that's almost invisible
      // RGBA doesn't seem to work consistently in Sigma.js v0.1
      e.color = '#ededed';  // Very light gray
      e.size = e.attr.originalSize * 0.5;  // Make non-connected edges thinner
    }
  });
  
  console.log("Edge processing complete. Total edges:", edgeCount, "Connected:", debugCounts.connected, "Not connected:", debugCounts.notConnected);
  
  // Force redraw
  sigmaInstance.draw(2, 2, 2, 2);
  
  // Add debug check after redraw to verify edge colors
  setTimeout(function() {
    console.log("Verifying edge colors after redraw:");
    let colorCount = { original: 0, greyed: 0, other: 0 };
    
    sigmaInstance.iterEdges(function(e) {
      if (e.color === '#ededed') {
        colorCount.greyed++;
      } else if (e.attr && e.attr.originalColor && e.color === e.attr.originalColor) {
        colorCount.original++;
      } else {
        colorCount.other++;
      }
    });
    
    console.log("Edge color counts:", colorCount);
  }, 100);
  
  // Show node details panel and populate it
  try {
    $('#attributepane')
      .show()
      .css({
        'display': 'block',
        'visibility': 'visible',
        'opacity': '1'
      });
  
  // Collect neighbor node information for the information panel
  sigmaInstance.iterNodes(function(n) {
    if (neighbors[n.id]) {
      neighbors[n.id].label = n.label || n.id;
      
      // Determine node type using multiple methods
      let nodeType = "unknown";
      
      // Method 1: Direct type property
      if (n.type) {
        nodeType = n.type;
      } 
      // Method 2: Parse from ID if it follows the format type_number
      else if (n.id && n.id.includes('_')) {
        const idParts = n.id.split('_');
        if (idParts.length >= 2 && ['paper', 'author', 'organization'].includes(idParts[0])) {
          nodeType = idParts[0];
        }
      }
      // Method 3: Try to determine from color
      else if (n.color) {
        // Match the color to known node types
        for (const type in config.nodeTypes) {
          if (config.nodeTypes[type].color === n.color) {
            nodeType = type;
            break;
          }
        }
        // Try with default node types if not found in config
        if (nodeType === "unknown") {
          for (const type in nodeTypes) {
            if (nodeTypes[type].color === n.color) {
              nodeType = type;
              break;
            }
          }
        }
      }
      
      neighbors[n.id].type = nodeType;
      neighbors[n.id].color = n.color;
    }
  });
  
  // Populate connection list
  var connectionList = [];
  // Group neighbors by type
  var neighborsByType = {};
  
  for (var id in neighbors) {
    var neighbor = neighbors[id];
    if (neighbor) {
      // Initialize array for this type if it doesn't exist
      neighborsByType[neighbor.type] = neighborsByType[neighbor.type] || [];
      // Add this neighbor to its type group
      neighborsByType[neighbor.type].push({
        id: id,
        label: neighbor.label || id,
        color: neighbor.color
      });
    }
  }
  
  // For each type, add a header and then list the connections
  // Sort types to have known types first, 'unknown' last
  let sortedTypes = Object.keys(neighborsByType).sort((a, b) => {
    if (a === 'unknown') return 1;
    if (b === 'unknown') return -1;
    return a.localeCompare(b);
  });
  
  sortedTypes.forEach(function(type) {
    // Get the color for this type from config
    var typeColor = config.nodeTypes && config.nodeTypes[type] ? 
                   config.nodeTypes[type].color : 
                   nodeTypes[type]?.color || '#666';
    
    // Debug connection types
    console.log(`Found ${neighborsByType[type].length} neighbors of type: ${type}`);
    
    // Get a readable type name
    let typeName = type;
    if (type === 'unknown') {
      typeName = 'Other Connections';
    }
    
    // Add a header for this type with appropriate styling
    connectionList.push('<li class="connection-type-header" style="margin-top: 8px; margin-bottom: 5px; font-weight: bold; color: ' + typeColor + ';">' + 
                       (type === 'unknown' ? typeName : typeName.charAt(0).toUpperCase() + typeName.slice(1) + 's') + 
                       ' (' + neighborsByType[type].length + '):</li>');
    
    // Add each connection of this type
    neighborsByType[type].forEach(function(neighbor) {
      // For unknown type connections, try to get a hint from the ID if available
      let labelHint = '';
      if (type === 'unknown' && neighbor.id && neighbor.id.includes('_')) {
        const idParts = neighbor.id.split('_');
        if (idParts.length >= 2) {
          labelHint = ` (${idParts[0]})`;
        }
      }
      
      connectionList.push('<li><a href="#" data-node-id="' + neighbor.id + '" style="color: ' + typeColor + ';">' + 
                         neighbor.label + labelHint + '</a></li>');
    });
  });
    
    // Set the node name/title
    $('.nodeattributes .name').text(selected.label || selected.id);
    
    // Debug the node object to see what fields are available
    console.log("Selected node:", selected);
    console.log("Node properties:");
    for (let prop in selected) {
      console.log(`- ${prop}: ${selected[prop]}`);
    }
    
    // Display the node type by parsing the ID
    let nodeType = null;
    
    // Try to parse the node type from the ID (format: type_number)
    if (selected.id && selected.id.includes('_')) {
      const idParts = selected.id.split('_');
      if (idParts.length >= 2) {
        nodeType = idParts[0];
        console.log("Extracted type from ID:", nodeType);
      }
    } 
    // Fallbacks if we couldn't get the type from ID
    else if (selected.type) {
      nodeType = selected.type;
      console.log("Node has type directly:", selected.type);
    } else if (selected.attr && selected.attr.type) {
      nodeType = selected.attr.type;
      console.log("Node has type in attr:", selected.attr.type);
    }
    
    // Format the type nicely - capitalize first letter
    if (nodeType) {
      nodeType = nodeType.charAt(0).toUpperCase() + nodeType.slice(1);
      $('.nodeattributes .nodetype').text('Type: ' + nodeType).show();
    } else {
      $('.nodeattributes .nodetype').hide();
    }
    
    // Simplify data display to only show degree
    let dataHTML = '';
    if (typeof selected.degree !== 'undefined') {
      dataHTML = '<div><strong>Degree:</strong> ' + selected.degree + '</div>';
    }
    
    if (dataHTML === '') dataHTML = '<div>No additional attributes</div>';
    $('.nodeattributes .data').html(dataHTML);
    
    // Build connection list
    $('.nodeattributes .link ul')
      .html(connectionList.length ? connectionList.join('') : '<li>No connections</li>')
      .css('display', 'block');
    
    // Bind click events for neighbor links
    $('.nodeattributes .link ul li a').click(function(e) {
      e.preventDefault();
      var nextNodeId = $(this).data('node-id');
      nodeActive(nextNodeId);
    });
    
  } catch (e) {
    console.error("Error updating attribute pane:", e);
  }
}

// Reset display - without color changes
function nodeNormal() {
  console.log("nodeNormal called");
  
  if (!sigmaInstance || !sigmaInstance.detail) {
    // Not in detail view, nothing to reset
    return;
  }
  
  sigmaInstance.detail = false;
  
  // Restore all original node attributes
  sigmaInstance.iterNodes(function(n) {
    n.attr = n.attr || {};
    
    // Restore original color
    if (typeof n.attr.originalColor !== 'undefined') {
      n.color = n.attr.originalColor;
      delete n.attr.originalColor;
    }
    
    // Restore original size if it was modified
    if (typeof n.attr.originalSize !== 'undefined') {
      n.size = n.attr.originalSize;
      delete n.attr.originalSize;
    }
    
    // When returning to full network, always hide all labels
    // Don't rely on originalForceLabel as it may maintain visibility
    n.forceLabel = false;
    delete n.attr.originalForceLabel;
    
    // Remove dimmed flag
    delete n.attr.dimmed;
  });
  
  // Restore original edge colors
  sigmaInstance.iterEdges(function(e) {
    e.attr = e.attr || {};
    // Restore color with explicit check for undefined
    if (typeof e.attr.originalColor !== 'undefined') {
      e.color = e.attr.originalColor;
      delete e.attr.originalColor;
    }
    // Restore size with explicit check for undefined
    if (typeof e.attr.originalSize !== 'undefined') {
      e.size = e.attr.originalSize;
      delete e.attr.originalSize;
    }
  });
  
  // Reset selected node
  selectedNode = null;
  
  // Hide attribute pane
  $('#attributepane').css({
    'display': 'none',
    'visibility': 'hidden'
  });
  
  // Force redraw
  sigmaInstance.draw(2, 2, 2, 2);
  
  // Ensure edge colors match target nodes after restoring
  try {
    if (typeof forceEdgeColors === 'function') {
      forceEdgeColors();
    }
  } catch (e) {
    console.error("Error refreshing edge colors:", e);
  }
}

// Helper function to convert colors to RGB
function getRGBColor(color) {
  // Handle hex colors
  if (color.charAt(0) === '#') {
    var r = parseInt(color.substr(1, 2), 16);
    var g = parseInt(color.substr(3, 2), 16);
    var b = parseInt(color.substr(5, 2), 16);
    return { r: r, g: g, b: b };
  }
  // Handle rgb colors
  else if (color.startsWith('rgb')) {
    var parts = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)$/);
    if (parts) {
      return {
        r: parseInt(parts[1], 10),
        g: parseInt(parts[2], 10),
        b: parseInt(parts[3], 10)
      };
    }
  }
  
  // Default fallback color
  return { r: 100, g: 100, b: 100 };
}

// Search nodes by term
function searchNodes(term) {
  if (!sigmaInstance) return;
  
  let results = [];
  let lowerTerm = term.toLowerCase();
  
  sigmaInstance.iterNodes(function(n) {
    if ((n.label && n.label.toLowerCase().indexOf(lowerTerm) >= 0) || 
        (n.id && n.id.toLowerCase().indexOf(lowerTerm) >= 0)) {
      results.push(n);
    }
  });
  
  // Limit to top 10 results
  results = results.slice(0, 10);
  
  // Display results
  let resultsHTML = '';
  if (results.length > 0) {
    results.forEach(function(n) {
      resultsHTML += '<a href="#" data-node-id="' + n.id + '">' + (n.label || n.id) + '</a>';
    });
  } else {
    resultsHTML = '<div>No results found</div>';
  }
  
  $('.results').html(resultsHTML);
  
  // Set up click event for results
  $('.results a').click(function(e) {
    e.preventDefault();
    let nodeId = $(this).data('node-id');
    nodeActive(nodeId);
  });
}

// Update the legend with node type information
function updateLegend() {
  console.log("Updating legend with node types");
  
  // Use configured node types with fallback to default types
  let typesToShow = config.nodeTypes || nodeTypes;
  
  // Create the HTML for the legend
  let legendHTML = '';
  
  // Make sure we're iterating through the object properties properly
  for (let type in typesToShow) {
    if (typesToShow.hasOwnProperty(type)) {
      let typeConfig = typesToShow[type];
      let color = typeConfig.color || '#ccc';
      
      legendHTML += `<div class="legend-item">
                     <div class="legend-color" style="background-color: ${color};"></div>
                     <div class="legend-label">${type}</div>
                   </div>`;
    }
  }
  
  // Add edge color information - always grey
  legendHTML += `<div class="legend-item">
                 <div class="legend-line" style="background-color: #ccc;"></div>
                 <div class="legend-label">Edge (Solid Grey)</div>
               </div>`;
  
  // Set the HTML
  $('#colorLegend').html(legendHTML);
} 