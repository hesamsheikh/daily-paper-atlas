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
  console.log("Document ready, checking Sigma.js availability");
  
  if (typeof sigma === 'undefined') {
    console.error("Sigma.js is not loaded!");
    return;
  }
  
  console.log("Sigma.js version:", sigma.version);
  
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

  // Call updateLegend immediately to ensure it runs
  setTimeout(function() {
    console.log("Forcing legend update from document ready");
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
    
    // Bind events
    console.log("Binding events...");
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

// Bind events
function bindEvents() {
  if (!sigmaInstance) {
    console.error("Sigma instance not found when binding events");
    return;
  }
  
  console.log("Starting to bind sigma events...");
  
  try {
    // When a node is clicked, display its details
    sigmaInstance.bind('clickNode', function(e) {
      console.log("Node clicked!", e);
      if (!e || !e.data || !e.data.node) {
        console.error("Click event missing node data");
        return;
      }
      
      var node = e.data.node;
      console.log("Clicked node:", node);
      
      if (e.data.captor.isDragging) {
        console.log("Ignoring click while dragging");
        return;
      }
      
      nodeActive(node.id);
    });
    
    // When stage is clicked, close the attribute pane
    sigmaInstance.bind('clickStage', function(e) {
      console.log("Stage clicked!", e);
      if (!e.data.node) {
        nodeNormal();
      }
    });
    
    // Add direct DOM click handler as backup
    document.getElementById('sigma-canvas').addEventListener('click', function(e) {
      console.log("Direct canvas click detected", e);
    });
    
    // Highlight connected nodes on hover
    sigmaInstance.bind('overNode', function(e) {
      // --- Completely disable hover effects when a node is selected --- 
      if (sigmaInstance.detail) {
        return; 
      }
      
      var node = e.data.node;
      var nodeId = node.id;
      console.log("Node hover enter:", nodeId);
      
      var neighbors = {};
      sigmaInstance.iterEdges(function(edge) {
        if (edge.source == nodeId || edge.target == nodeId) {
          neighbors[edge.source == nodeId ? edge.target : edge.source] = true;
        }
      });
      
      sigmaInstance.iterNodes(function(n) {
        // Store original color only if not already stored
        if (n.originalColor === undefined) n.originalColor = n.color;
        if (n.id != nodeId && !neighbors[n.id]) {
          n.color = greyColor;
        }
      });
      
      sigmaInstance.iterEdges(function(edge) {
        // Store original color only if not already stored
        if (edge.originalColor === undefined) edge.originalColor = edge.color;
        if (edge.source != nodeId && edge.target != nodeId) {
          edge.color = greyColor;
        }
      });
      
      sigmaInstance.refresh();
    });
    
    sigmaInstance.bind('outNode', function(e) {
      // --- Completely disable hover effects when a node is selected --- 
      if (sigmaInstance.detail) { 
        return;
      }
      
      var node = e.data.node;
      var nodeId = node.id;
      console.log("Node hover leave:", nodeId);
      
      // Restore original colors and clean up
      sigmaInstance.iterNodes(function(n) {
        if (n.originalColor !== undefined) {
          n.color = n.originalColor;
          delete n.originalColor;
        }
      });
      
      sigmaInstance.iterEdges(function(e_edge) {
        if (e_edge.originalColor !== undefined) {
          e_edge.color = e_edge.originalColor;
          delete e_edge.originalColor;
        }
      });
      
      sigmaInstance.refresh();
    });
    console.log("Event binding completed successfully");
  } catch (e) {
    console.error("Error in bindEvents:", e);
  }
}

// Display node details (used when a node is clicked)
function nodeActive(nodeId) {
  console.log("nodeActive called with id:", nodeId);
  
  if (!sigmaInstance) {
    console.error("Sigma instance not ready for nodeActive");
    return;
  }
  
  // Find the selected node
  var selected = null;
  sigmaInstance.iterNodes(function(n) {
    if (n.id == nodeId) {
      selected = n;
      console.log("Found selected node:", n);
      // Store original size if not already stored
      if (n.originalSize === undefined) n.originalSize = n.size;
    }
  });
  
  if (!selected) {
    console.error("Node not found:", nodeId);
    return;
  }
  
  console.log("Node found:", selected);
  sigmaInstance.detail = true;
  selectedNode = selected;
  
  // Find neighbors
  var neighbors = {};
  neighbors[nodeId] = true; // Include the selected node itself
  
  sigmaInstance.iterEdges(function(e) {
    if (e.source == nodeId) {
      neighbors[e.target] = true;
    } else if (e.target == nodeId) {
      neighbors[e.source] = true;
    }
  });
  
  var neighborIds = Object.keys(neighbors);
  console.log("Neighbors found (including self):", neighborIds.length);

  // Dim non-neighbor nodes and edges
  sigmaInstance.iterNodes(function(n) {
    if (neighbors[n.id]) {
      n.color = n.originalColor || n.color;
      if (n.id === nodeId) {
        n.size = (n.originalSize || n.size) * 1.5;
      }
    } else {
      n.color = greyColor;
    }
  });
  
  sigmaInstance.iterEdges(function(e) {
    if (neighbors[e.source] && neighbors[e.target]) {
      e.color = e.originalColor || e.color;
    } else {
      e.color = greyColor;
    }
  });

  // Show node details panel
  try {
    console.log("Displaying attribute pane");
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
          attr !== 'label' && attr !== 'originalColor' && attr !== 'originalSize' && attr !== 'hidden' && 
          typeof selected[attr] !== 'function' && attr !== 'displayX' && attr !== 'displayY' && 
          attr !== 'displaySize' && !attr.startsWith('_')) {
        dataHTML += '<div><strong>' + attr + ':</strong> ' + selected[attr] + '</div>';
      }
    }
    
    if (dataHTML === '') dataHTML = '<div>No additional attributes</div>';
    $('.nodeattributes .data').html(dataHTML);
    
    // Build connection list
    var connectionList = [];
    sigmaInstance.iterNodes(function(n) {
      if (neighbors[n.id] && n.id !== nodeId) {
        connectionList.push('<li><a href="#" data-node-id="' + n.id + '">' + (n.label || n.id) + '</a></li>');
      }
    });
    
    $('.nodeattributes .link ul')
      .html(connectionList.length ? connectionList.join('') : '<li>No connections</li>')
      .css('display', 'block');
    
    // Bind click events for neighbor links
    $('.nodeattributes .link ul li a').click(function(e) {
      e.preventDefault();
      var nextNodeId = $(this).data('node-id');
      nodeActive(nextNodeId);
    });
    
    console.log("Attribute pane updated successfully");
  } catch (e) {
    console.error("Error updating attribute pane:", e);
  }
  
  // Force a refresh to show changes
  sigmaInstance.refresh();
}

// Reset display (used when clicking outside nodes or closing the panel)
function nodeNormal() {
  console.log("nodeNormal called");
  if (!sigmaInstance) {
    console.warn("Sigma instance not ready for nodeNormal");
    return;
  }
  
  sigmaInstance.detail = false;
  
  // Restore all nodes and edges to original state
  sigmaInstance.iterNodes(function(n) {
    if (n.originalColor !== undefined) {
      n.color = n.originalColor;
      delete n.originalColor;
    }
    if (n.originalSize !== undefined) {
      n.size = n.originalSize;
      delete n.originalSize;
    }
  });
  
  sigmaInstance.iterEdges(function(e) {
    if (e.originalColor !== undefined) {
      e.color = e.originalColor;
      delete e.originalColor;
    }
  });
  
  // Reset selected node
  selectedNode = null;
  
  // Hide attribute pane
  $('#attributepane').css({
    'display': 'none',
    'visibility': 'hidden'
  });
  
  // Refresh display
  sigmaInstance.refresh();
  console.log("Graph reset to normal state");
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

// Update the legend with node type information
function updateLegend() {
  console.log("Updating legend with node types");
  
  // Use configured node types with fallback to default types
  let typesToShow = config.nodeTypes || nodeTypes;
  console.log("Node types for legend:", JSON.stringify(typesToShow));
  
  // If typesToShow is empty or has no properties, use a default set
  if (!typesToShow || Object.keys(typesToShow).length === 0) {
    console.log("No node types found, using defaults");
    typesToShow = {
      'paper': { color: '#2ca02c', size: 3 },
      'author': { color: '#9467bd', size: 5 },
      'organization': { color: '#1f77b4', size: 4 },
      'document': { color: '#ff7f0e', size: 3 }
    };
  }
  
  // Create the HTML for the legend
  let legendHTML = '';
  
  // Make sure we're iterating through the object properties properly
  for (let type in typesToShow) {
    if (typesToShow.hasOwnProperty(type)) {
      let typeConfig = typesToShow[type];
      let color = typeConfig.color || '#ccc';
      console.log(`Adding legend item for ${type} with color ${color}`);
      
      legendHTML += `<div class="legend-item">
                     <div class="legend-color" style="background-color: ${color};"></div>
                     <div class="legend-label">${type}</div>
                   </div>`;
    }
  }
  
  // If we still have no legend items, add some defaults
  if (legendHTML === '') {
    console.log("Legend is still empty, adding hardcoded defaults");
    legendHTML = `
      <div class="legend-item">
        <div class="legend-color" style="background-color: #2ca02c;"></div>
        <div class="legend-label">Paper</div>
      </div>
      <div class="legend-item">
        <div class="legend-color" style="background-color: #9467bd;"></div>
        <div class="legend-label">Author</div>
      </div>
      <div class="legend-item">
        <div class="legend-color" style="background-color: #1f77b4;"></div>
        <div class="legend-label">Organization</div>
      </div>
    `;
  }
  
  // Add legend for edges
  legendHTML += `<div class="legend-item">
                   <div class="legend-line"></div>
                   <div class="legend-label">Connections</div>
                 </div>`;
  
  // Set the HTML and make sure the element exists
  let legendElement = document.getElementById('colorLegend');
  if (legendElement) {
    console.log("Legend element found, setting HTML:", legendHTML);
    legendElement.innerHTML = legendHTML;
    
    // Force legend to be visible
    legendElement.style.display = "block";
    
    // Also try with jQuery to ensure it's visible
    $('#colorLegend').html(legendHTML).show();
  } else {
    console.error("Legend element #colorLegend not found in the DOM");
    
    // Try using jQuery as a fallback
    console.log("Trying to find legend with jQuery");
    if ($('#colorLegend').length) {
      console.log("Found with jQuery, setting content");
      $('#colorLegend').html(legendHTML).show();
    } else {
      console.error("Legend not found with jQuery either");
    }
  }
}

// Add a function to manually check and ensure our legend gets populated
$(window).on('load', function() {
  setTimeout(function() {
    console.log("Window loaded, checking if legend is populated");
    let legendElement = document.getElementById('colorLegend');
    if (legendElement && (!legendElement.innerHTML || legendElement.innerHTML.trim() === '')) {
      console.log("Legend is empty, manually updating it");
      updateLegend();
    }
  }, 1000);
}); 