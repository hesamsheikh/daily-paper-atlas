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
  console.log("Document ready, initializing Daily Paper Atlas");
  
  // Initialize attribute pane
  $('#attributepane').css('display', 'none');
  
  // Load configuration
  $.getJSON('config.json', function(data) {
    console.log("Configuration loaded:", data);
    config = data;
    document.title = config.text.title || 'Daily Paper Atlas';
    $('#title').text(config.text.title || 'Daily Paper Atlas');
    $('#titletext').text(config.text.intro || '');
    loadGraph();
  }).fail(function(jqXHR, textStatus, errorThrown) {
    console.error("Failed to load config:", textStatus, errorThrown);
  });

  // Set up search functionality
  $('#search-input').keyup(function(e) {
    let searchTerm = $(this).val();
    if (searchTerm.length > 2) {
      searchNodes(searchTerm);
    } else {
      $('.results').empty();
    }
  });
  
  $('#search-button').click(function() {
    let searchTerm = $('#search-input').val();
    if (searchTerm.length > 2) {
      searchNodes(searchTerm);
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
    }
    
    // Add edges to the graph
    console.log("Adding edges to sigma instance...");
    for (let i = 0; i < graph.edges.length; i++) {
      let edge = graph.edges[i];
      sigmaInstance.addEdge(edge.id, edge.source, edge.target, {
        size: edge.size || 1,
        color: edge.color || '#ccc'
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
      edgeColor: 'target',
      defaultEdgeColor: '#ccc'
    });
    
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
    sigmaInstance.iterNodes(function(node) {
      if (node.type && config.nodeTypes && config.nodeTypes[node.type]) {
        node.color = config.nodeTypes[node.type].color;
        node.size = config.nodeTypes[node.type].size;
      } else if (node.type && nodeTypes[node.type]) {
        node.color = nodeTypes[node.type].color;
        node.size = nodeTypes[node.type].size;
      }
    });
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
    console.log("Node clicked:", event);
    if (event.content && event.content.length > 0) {
      var nodeId = event.content[0];
      nodeActive(nodeId);
    }
  });
  
  // When stage is clicked, close the attribute pane
  document.getElementById('sigma-canvas').addEventListener('click', function(evt) {
    // Only process if we didn't click on a node (checked by looking at sigma's settings)
    if (!sigmaInstance.isMouseDown && !sigmaInstance.detail) {
      nodeNormal();
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
  
  // Mark as in detail view
  sigmaInstance.detail = true;
  
  // Store reference to selected node
  selectedNode = selected;
  
  // Find neighbors
  var neighbors = {};
  sigmaInstance.iterEdges(function(e) {
    if (e.source == nodeId || e.target == nodeId) {
      neighbors[e.source == nodeId ? e.target : e.source] = true;
    }
  });
  
  // In Sigma.js v0.1, we need to use a different approach for focus
  // Store original colors for all nodes and edges
  sigmaInstance.iterNodes(function(n) {
    n.attr = n.attr || {};
    n.attr.originalColor = n.color;
    
    if (n.id === nodeId) {
      // Make selected node slightly larger
      n.attr.originalSize = n.size;
      n.size = n.size * 1.5;
    } else if (!neighbors[n.id]) {
      // For non-neighbor nodes, we use a custom attribute to track they should be dimmed
      // (Sigma v0.1 doesn't support opacity directly)
      n.attr.dimmed = true;
      // Apply a transparent version of the original color
      var rgb = getRGBColor(n.color);
      n.color = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.2)';
    }
  });
  
  // Apply the same to edges
  sigmaInstance.iterEdges(function(e) {
    e.attr = e.attr || {};
    
    // First, store the original color
    if (!e.attr.originalColor) {
      e.attr.originalColor = e.color;
    }
    
    // Direct check for connected edges - need to account for both string and object references
    let isConnected = false;
    
    // Check source connection
    if (typeof e.source === 'object' && e.source !== null) {
      if (e.source.id == nodeId) isConnected = true;
    } else if (String(e.source) == String(nodeId)) {
      isConnected = true;
    }
    
    // Check target connection
    if (typeof e.target === 'object' && e.target !== null) {
      if (e.target.id == nodeId) isConnected = true;
    } else if (String(e.target) == String(nodeId)) {
      isConnected = true;
    }
    
    // For debugging
    if (isConnected) {
      console.log("Edge connected:", e.id, 
                 "Source:", (typeof e.source === 'object' ? e.source.id : e.source), 
                 "Target:", (typeof e.target === 'object' ? e.target.id : e.target));
      
      // IMPORTANT: Make sure the color is the original (non-dimmed) color
      // In Sigma.js v0.1, we need to completely reset the color property
      e.color = e.attr.originalColor;
    } else {
      // For non-connected edges, apply the dimmed color
      let rgb = getRGBColor(e.attr.originalColor);
      e.color = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.2)';
    }
  });
  
  // Force redraw
  sigmaInstance.draw(2, 2, 2, 2);
  
  // Show node details panel and populate it
  try {
    $('#attributepane')
      .show()
      .css({
        'display': 'block',
        'visibility': 'visible',
        'opacity': '1'
      });
    
    $('.nodeattributes .name').text(selected.label || selected.id);
    
    let dataHTML = '';
    for (let attr in selected) {
      if (attr !== 'id' && attr !== 'x' && attr !== 'y' && attr !== 'size' && attr !== 'color' && 
          attr !== 'label' && attr !== 'hidden' && attr !== 'attr' &&
          typeof selected[attr] !== 'function' && attr !== 'displayX' && attr !== 'displayY' && 
          attr !== 'displaySize' && !attr.startsWith('_')) {
        dataHTML += '<div><strong>' + attr + ':</strong> ' + selected[attr] + '</div>';
      }
    }
    
    if (dataHTML === '') dataHTML = '<div>No additional attributes</div>';
    $('.nodeattributes .data').html(dataHTML);
    
    // Build connection list
    var connectionList = [];
    for (var id in neighbors) {
      var neighborNode = null;
      sigmaInstance.iterNodes(function(n) { 
        if (n.id == id) neighborNode = n;
      });
      
      if (neighborNode) {
        connectionList.push('<li><a href="#" data-node-id="' + id + '">' + (neighborNode.label || id) + '</a></li>');
      }
    }
    
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
    if (n.attr.originalColor) {
      n.color = n.attr.originalColor;
      delete n.attr.originalColor;
    }
    
    // Restore original size if it was modified
    if (n.attr.originalSize) {
      n.size = n.attr.originalSize;
      delete n.attr.originalSize;
    }
    
    // Remove dimmed flag
    delete n.attr.dimmed;
  });
  
  // Restore original edge colors
  sigmaInstance.iterEdges(function(e) {
    e.attr = e.attr || {};
    if (e.attr.originalColor) {
      e.color = e.attr.originalColor;
      delete e.attr.originalColor;
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
  
  // Add legend for edges
  legendHTML += `<div class="legend-item">
                   <div class="legend-line"></div>
                   <div class="legend-label">Connections</div>
                 </div>`;
  
  // Set the HTML
  $('#colorLegend').html(legendHTML);
} 