// Global variables
let sigmaInstance;
let graph;
let filter;
let config = {};
let greyColor = '#ccc';
let activeState = { activeNodes: [], activeEdges: [] };
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

  // Set up color selector
  $('#color-attribute').change(function() {
    let attr = $(this).val();
    colorNodesByAttribute(attr);
  });
  
  // Set up filter selector
  $('#filter-select').change(function() {
    let filterValue = $(this).val();
    filterByNodeType(filterValue);
  });
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
    
    for (let i = 0; i < graph.edges.length; i++) {
      let edge = graph.edges[i];
      sigmaInstance.addEdge(edge.id, edge.source, edge.target, {
        size: edge.size || 1,
        color: edge.color || '#aaa'
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
      defaultNodeHoverColor: '#fff'
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
    sigmaInstance.refresh();
    
    console.log("Sigma instance created and configured:", sigmaInstance);
    
    // Initialize ForceAtlas2 layout if configured
    if (config.features && config.features.forceAtlas2) {
      console.log("Starting ForceAtlas2 layout...");
      sigmaInstance.startForceAtlas2();
      
      setTimeout(function() {
        sigmaInstance.stopForceAtlas2();
        console.log("ForceAtlas2 layout completed");
        sigmaInstance.refresh();
        
        // Initialize node colors and sizes by type
        applyNodeStyles();
        
        // Initialize filtering
        initFilters();
        
        // If a default color attribute is set, apply it
        if (config.features && config.features.defaultColorAttribute) {
          $('#color-attribute').val(config.features.defaultColorAttribute);
          colorNodesByAttribute(config.features.defaultColorAttribute);
        } else {
          updateColorLegend(nodeTypes);
        }
        
        // Bind events
        bindEvents();
      }, config.features?.forceAtlas2Time || 5000);
    } else {
      // Initialize node colors and sizes by type
      applyNodeStyles();
      
      // Initialize filtering
      initFilters();
      
      // If a default color attribute is set, apply it
      if (config.features && config.features.defaultColorAttribute) {
        $('#color-attribute').val(config.features.defaultColorAttribute);
        colorNodesByAttribute(config.features.defaultColorAttribute);
      } else {
        updateColorLegend(nodeTypes);
      }
      
      // Bind events
      bindEvents();
    }
  } catch (e) {
    console.error("Error initializing sigma instance:", e);
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

// Bind events
function bindEvents() {
  if (!sigmaInstance) {
    console.error("Sigma instance not found when binding events");
    return;
  }
  
  console.log("Binding sigma events to instance:", sigmaInstance);
  
  // Add a direct click handler to the sigma canvas
  document.getElementById('sigma-canvas').addEventListener('click', function(evt) {
    console.log("Canvas clicked, checking if it's on a node");
    // The event happened on canvas, now check if it was on a node
    var x = evt.offsetX || evt.layerX;
    var y = evt.offsetY || evt.layerY;
    
    var nodeFound = false;
    sigmaInstance.iterNodes(function(n) {
      if (!nodeFound && n.displayX && n.displayY && n.displaySize) {
        var dx = n.displayX - x;
        var dy = n.displayY - y;
        var distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < n.displaySize) {
          console.log("Node found under click:", n.id);
          nodeFound = true;
          nodeActive(n.id);
        }
      }
    });
    
    if (!nodeFound) {
      console.log("No node found under click, closing node panel");
      nodeNormal();
    }
  });
  
  // Still try to use sigma's events
  try {
    // When a node is clicked, display its details
    sigmaInstance.bind('clickNode', function(e) {
      var node = e.target || e.data.node || e.data;
      console.log("Official clickNode event received:", e);
      var nodeId = node.id || node;
      console.log("Node clicked via official event:", nodeId);
      nodeActive(nodeId);
    });
    
    // When stage is clicked, close the attribute pane
    sigmaInstance.bind('clickStage', function() {
      console.log("Official clickStage event received");
      nodeNormal();
    });
    
    // Highlight connected nodes on hover
    sigmaInstance.bind('overNode', function(e) {
      var node = e.target || e.data.node || e.data;
      var nodeId = node.id || node;
      console.log("Node hover enter:", nodeId);
      
      // First identify neighbors
      var neighbors = {};
      sigmaInstance.iterEdges(function(edge) {
        if (edge.source == nodeId || edge.target == nodeId) {
          neighbors[edge.source == nodeId ? edge.target : edge.source] = true;
        }
      });
      
      // Then update node and edge colors
      sigmaInstance.iterNodes(function(node) {
        if (node.id == nodeId || neighbors[node.id]) {
          node.originalColor = node.color;
        } else {
          node.originalColor = node.originalColor || node.color;
          node.color = greyColor;
        }
      });
      
      sigmaInstance.iterEdges(function(edge) {
        if (edge.source == nodeId || edge.target == nodeId) {
          edge.originalColor = edge.color;
        } else {
          edge.originalColor = edge.originalColor || edge.color;
          edge.color = greyColor;
        }
      });
      
      sigmaInstance.refresh();
    });
    
    sigmaInstance.bind('outNode', function(e) {
      var node = e.target || e.data.node || e.data;
      var nodeId = node.id || node;
      console.log("Node hover leave:", nodeId);
      
      if (!sigmaInstance.detail) {
        sigmaInstance.iterNodes(function(n) {
          n.color = n.originalColor || n.color;
        });
        
        sigmaInstance.iterEdges(function(e) {
          e.color = e.originalColor || e.color;
        });
        
        sigmaInstance.refresh();
      }
    });
    console.log("Sigma events bound successfully");
  } catch (e) {
    console.error("Error binding sigma events:", e);
  }
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
  
  // Find neighbors
  var neighbors = {};
  sigmaInstance.iterEdges(function(e) {
    if (e.source == nodeId || e.target == nodeId) {
      neighbors[e.source == nodeId ? e.target : e.source] = {
        name: e.label || "",
        color: e.color
      };
    }
  });
  
  console.log("Neighbors found:", Object.keys(neighbors).length);
  
  // Update node appearance
  sigmaInstance.iterNodes(function(n) {
    if (n.id == nodeId) {
      n.color = n.originalColor || n.color;
      n.size = n.size * 1.5; // Emphasize selected node
    } else if (neighbors[n.id]) {
      n.color = n.originalColor || n.color;
    } else {
      n.originalColor = n.originalColor || n.color;
      n.color = greyColor;
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
  
  sigmaInstance.refresh();
  
  // Update color legend
  updateColorLegend(valueColors);
}

// Update color legend
function updateColorLegend(valueColors) {
  let legendHTML = '';
  
  for (let value in valueColors) {
    let color = valueColors[value];
    if (typeof color === 'object') {
      color = color.color;
    }
    legendHTML += '<div class="legenditem"><span class="legendcolor" style="background-color: ' + color + '"></span>' + value + '</div>';
  }
  
  $('#colorLegend').html(legendHTML);
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