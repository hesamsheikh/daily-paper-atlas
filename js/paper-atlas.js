// Global variables
let sigmaInstance;
let graph;
let filter;
let config = {};
let greyColor = '#666';
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
  // Load configuration
  $.getJSON('config.json', function(data) {
    config = data;
    document.title = config.title || '🤗 Daily Papers Atlas';
    $('#title').text(config.title || '🤗 Daily Papers Atlas');
    
    // Don't modify the intro text at all - using hardcoded HTML
    
    loadGraph();
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
    if (sigmaInstance) sigmaInstance.camera.goTo({ratio: sigmaInstance.camera.ratio / 1.5});
  });
  
  $('#zoom .z[rel="out"]').click(function() {
    if (sigmaInstance) sigmaInstance.camera.goTo({ratio: sigmaInstance.camera.ratio * 1.5});
  });
  
  $('#zoom .z[rel="center"]').click(function() {
    if (sigmaInstance) sigmaInstance.camera.goTo({x: 0, y: 0, ratio: 1});
  });

  // Set up attribute pane functionality
  $('.returntext').click(function() {
    closeAttributePane();
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
  $.getJSON(config.data, function(data) {
    graph = data;
    
    // Initialize Sigma instance
    sigmaInstance = new sigma({
      graph: graph,
      container: 'sigma-canvas',
      settings: {
        labelThreshold: config.labelThreshold || 7,
        minEdgeSize: config.minEdgeSize || 0.5,
        maxEdgeSize: config.maxEdgeSize || 2,
        minNodeSize: config.minNodeSize || 1,
        maxNodeSize: config.maxNodeSize || 8,
        drawLabels: config.drawLabels !== false,
        defaultLabelColor: config.defaultLabelColor || '#000',
        defaultEdgeColor: config.defaultEdgeColor || '#999',
        edgeColor: 'default',
        defaultNodeColor: config.defaultNodeColor || '#666',
        defaultNodeBorderColor: config.defaultNodeBorderColor || '#fff',
        borderSize: config.borderSize || 1,
        nodeHoverColor: 'default',
        defaultNodeHoverColor: config.defaultNodeHoverColor || '#000',
        defaultHoverLabelBGColor: config.defaultHoverLabelBGColor || '#fff',
        defaultLabelHoverColor: config.defaultLabelHoverColor || '#000',
        enableEdgeHovering: config.enableEdgeHovering !== false,
        edgeHoverColor: 'edge',
        edgeHoverSizeRatio: config.edgeHoverSizeRatio || 1.5,
        defaultEdgeHoverColor: config.defaultEdgeHoverColor || '#000',
        edgeHoverExtremities: config.edgeHoverExtremities !== false,
        batchEdgesDrawing: config.batchEdgesDrawing !== false,
        hideEdgesOnMove: config.hideEdgesOnMove !== false,
        canvasEdgesBatchSize: config.canvasEdgesBatchSize || 500,
        animationsTime: config.animationsTime || 1500
      }
    });

    // Initialize ForceAtlas2 layout
    if (config.forceAtlas2) {
      console.log("Starting ForceAtlas2 layout...");
      sigmaInstance.startForceAtlas2({
        worker: true,
        barnesHutOptimize: true,
        gravity: 1,
        scalingRatio: 2,
        slowDown: 10
      });
      
      setTimeout(function() {
        sigmaInstance.stopForceAtlas2();
        console.log("ForceAtlas2 layout completed");
        sigmaInstance.refresh();
        
        // Initialize node colors and sizes by type
        applyNodeStyles();
        
        // Initialize filtering
        initFilters();
        
        // If a default color attribute is set, apply it
        if (config.defaultColorAttribute) {
          $('#color-attribute').val(config.defaultColorAttribute);
          colorNodesByAttribute(config.defaultColorAttribute);
        } else {
          updateColorLegend(nodeTypes);
        }
        
        // Bind events
        bindEvents();
        
      }, config.forceAtlas2Time || 5000);
    } else {
      // Initialize node colors and sizes by type
      applyNodeStyles();
      
      // Initialize filtering
      initFilters();
      
      // If a default color attribute is set, apply it
      if (config.defaultColorAttribute) {
        $('#color-attribute').val(config.defaultColorAttribute);
        colorNodesByAttribute(config.defaultColorAttribute);
      } else {
        updateColorLegend(nodeTypes);
      }
      
      // Bind events
      bindEvents();
    }
  }).fail(function(jqXHR, textStatus, errorThrown) {
    console.error("Failed to load graph data:", textStatus, errorThrown);
    alert('Failed to load graph data. Please check the console for more details.');
  });
}

// Apply node styles based on node type
function applyNodeStyles() {
  sigmaInstance.graph.nodes().forEach(function(node) {
    if (node.type && config.nodeTypes && config.nodeTypes[node.type]) {
      node.color = config.nodeTypes[node.type].color;
      node.size = config.nodeTypes[node.type].size;
    } else if (node.type && nodeTypes[node.type]) {
      node.color = nodeTypes[node.type].color;
      node.size = nodeTypes[node.type].size;
    }
  });
  sigmaInstance.refresh();
}

// Initialize filters
function initFilters() {
  try {
    filter = new sigma.plugins.filter(sigmaInstance);
    console.log("Filter plugin initialized");
  } catch (e) {
    console.error("Error initializing filter plugin:", e);
  }
}

// Filter nodes by type
function filterByNodeType(filterValue) {
  if (!filter) return;
  
  filter.undo('node-type');
  
  if (filterValue !== 'all') {
    filter.nodesBy(function(n) {
      return n.type === filterValue;
    }, 'node-type');
  }
  
  filter.apply();
  sigmaInstance.refresh();
}

// Bind events
function bindEvents() {
  // When a node is clicked, display its details
  sigmaInstance.bind('clickNode', function(e) {
    let node = e.data.node;
    selectedNode = node;
    displayNodeDetails(node);
  });
  
  // When stage is clicked, close the attribute pane
  sigmaInstance.bind('clickStage', function() {
    closeAttributePane();
  });
  
  // Highlight connected nodes on hover
  sigmaInstance.bind('hovers', function(e) {
    if (!e.data.enter.nodes.length) return;
    
    let nodeId = e.data.enter.nodes[0];
    let toKeep = sigmaInstance.graph.neighbors(nodeId);
    toKeep[nodeId] = e.data.enter.nodes[0];
    
    activeState.activeNodes = Object.keys(toKeep);
    
    sigmaInstance.graph.nodes().forEach(function(n) {
      if (toKeep[n.id]) {
        n.originalColor = n.color;
        n.color = n.color;
      } else {
        n.originalColor = n.originalColor || n.color;
        n.color = greyColor;
      }
    });
    
    sigmaInstance.graph.edges().forEach(function(e) {
      if (toKeep[e.source] && toKeep[e.target]) {
        e.originalColor = e.color;
        e.color = e.color;
      } else {
        e.originalColor = e.originalColor || e.color;
        e.color = greyColor;
      }
    });
    
    sigmaInstance.refresh();
  });
  
  sigmaInstance.bind('hovers', function(e) {
    if (e.data.leave.nodes.length && !selectedNode) {
      sigmaInstance.graph.nodes().forEach(function(n) {
        n.color = n.originalColor || n.color;
      });
      
      sigmaInstance.graph.edges().forEach(function(e) {
        e.color = e.originalColor || e.color;
      });
      
      sigmaInstance.refresh();
    }
  });
}

// Display node details in the attribute pane
function displayNodeDetails(node) {
  $('#attributepane').show();
  $('.nodeattributes .name').text(node.label || node.id);
  
  let dataHTML = '';
  for (let attr in node) {
    if (attr !== 'id' && attr !== 'x' && attr !== 'y' && attr !== 'size' && attr !== 'color' && 
        attr !== 'label' && attr !== 'originalColor' && attr !== 'hidden') {
      dataHTML += '<div><strong>' + attr + ':</strong> ' + node[attr] + '</div>';
    }
  }
  $('.nodeattributes .data').html(dataHTML);
  
  // Display connected nodes
  let neighbors = sigmaInstance.graph.neighbors(node.id);
  let linksHTML = '';
  for (let id in neighbors) {
    let neighbor = sigmaInstance.graph.nodes(id);
    if (neighbor) {
      linksHTML += '<li><a href="#" data-node-id="' + id + '">' + (neighbor.label || id) + '</a></li>';
    }
  }
  $('.nodeattributes .link ul').html(linksHTML);
  
  // Set up click event for connected nodes
  $('.nodeattributes .link ul li a').click(function(e) {
    e.preventDefault();
    let nodeId = $(this).data('node-id');
    let node = sigmaInstance.graph.nodes(nodeId);
    if (node) {
      selectedNode = node;
      displayNodeDetails(node);
      sigmaInstance.renderers[0].dispatchEvent('clickNode', {
        node: node
      });
    }
  });
}

// Close the attribute pane
function closeAttributePane() {
  $('#attributepane').hide();
  selectedNode = null;
  
  // Reset colors
  sigmaInstance.graph.nodes().forEach(function(n) {
    n.color = n.originalColor || n.color;
  });
  
  sigmaInstance.graph.edges().forEach(function(e) {
    e.color = e.originalColor || e.color;
  });
  
  sigmaInstance.refresh();
}

// Color nodes by attribute
function colorNodesByAttribute(attribute) {
  // Get all unique values for the attribute
  let values = {};
  let valueCount = 0;
  
  sigmaInstance.graph.nodes().forEach(function(n) {
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
  sigmaInstance.graph.nodes().forEach(function(n) {
    let value = n[attribute] || 'unknown';
    n.originalColor = valueColors[value];
    if (!selectedNode) {
      n.color = valueColors[value];
    }
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
  let results = [];
  let lowerTerm = term.toLowerCase();
  
  sigmaInstance.graph.nodes().forEach(function(n) {
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
    let node = sigmaInstance.graph.nodes(nodeId);
    if (node) {
      // Center the camera on the node
      sigmaInstance.camera.goTo({
        x: node[sigmaInstance.camera.readPrefix + 'x'],
        y: node[sigmaInstance.camera.readPrefix + 'y'],
        ratio: 0.5
      });
      
      // Select the node
      selectedNode = node;
      displayNodeDetails(node);
    }
  });
} 