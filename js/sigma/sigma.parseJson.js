// // Scott Hale (Oxford Internet Institute)
// // Requires sigma.js and jquery to be loaded
// // based on parseGexf from Mathieu Jacomy @ Sciences Po Médialab & WebAtlas


var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

// Regular implementation for Chrome and other browsers
sigma.publicPrototype.parseJson = function(gzippedJsonPath, callback) {
  var sigmaInstance = this;
  
  // Use XMLHttpRequest for binary data
  var xhr = new XMLHttpRequest();
  xhr.open('GET', gzippedJsonPath, true);
  xhr.responseType = 'arraybuffer';
  
  xhr.onload = function() {
    if (xhr.status === 200) {
      try {
        // Decompress the gzipped data using pako
        var inflatedData = pako.inflate(new Uint8Array(xhr.response));
        
        // Convert binary data to string
        var jsonString = new TextDecoder('utf-8').decode(inflatedData);
        
        // Parse the JSON
        var jsonData = JSON.parse(jsonString);
        
        // Process nodes
        for (var i = 0; i < jsonData.nodes.length; i++) {
          var id = jsonData.nodes[i].id;
          sigmaInstance.addNode(id, jsonData.nodes[i]);
        }
        
        // Process edges
        for (var j = 0; j < jsonData.edges.length; j++) {
          var edgeNode = jsonData.edges[j];
          var source = edgeNode.source;
          var target = edgeNode.target;
          var label = edgeNode.label;
          var eid = edgeNode.id;
          
          sigmaInstance.addEdge(eid, source, target, edgeNode);
        }
        
        // Call the callback function if provided
        if (callback) {
          callback.call(sigmaInstance);
        }
      } catch (error) {
        console.error("Error processing gzipped JSON:", error);
      }
    } else {
      console.error("Error fetching gzipped JSON. Status:", xhr.status);
    }
  };
  
  xhr.onerror = function() {
    console.error("Network error while fetching gzipped JSON");
  };
  
  xhr.send();
};


// Create a new function specifically for loading gzipped data safely
// This avoids sigma initialization issues by loading data first
var loadGzippedGraphData = function(gzippedJsonPath, callback) {
  // Use XMLHttpRequest for binary data
  var xhr = new XMLHttpRequest();
  xhr.open('GET', gzippedJsonPath, true);
  xhr.responseType = 'arraybuffer';
  
  xhr.onload = function() {
    if (xhr.status === 200) {
      try {
        // Decompress the gzipped data using pako
        var inflatedData = pako.inflate(new Uint8Array(xhr.response));
        
        // Convert binary data to string
        var jsonString;
        try {
          jsonString = new TextDecoder('utf-8').decode(inflatedData);
        } catch (e) {
          // Fallback for older browsers
          jsonString = "";
          var array = inflatedData;
          var i = 0, len = array.length;
          var c, char2, char3;
          
          while (i < len) {
            c = array[i++];
            switch (c >> 4) {
              case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
                // 0xxxxxxx
                jsonString += String.fromCharCode(c);
                break;
              case 12: case 13:
                // 110x xxxx   10xx xxxx
                char2 = array[i++];
                jsonString += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
                break;
              case 14:
                // 1110 xxxx  10xx xxxx  10xx xxxx
                char2 = array[i++];
                char3 = array[i++];
                jsonString += String.fromCharCode(((c & 0x0F) << 12) |
                                               ((char2 & 0x3F) << 6) |
                                               ((char3 & 0x3F) << 0));
                break;
            }
          }
        }
        
        // Parse the JSON
        var jsonData = JSON.parse(jsonString);
        
        // Return the parsed data to the callback
        if (callback) {
          callback(jsonData);
        }
      } catch (error) {
        console.error("Error processing gzipped JSON:", error);
        if (callback) {
          callback(null, error);
        }
      }
    } else {
      console.error("Error fetching gzipped JSON. Status:", xhr.status);
      if (callback) {
        callback(null, new Error("HTTP status: " + xhr.status));
      }
    }
  };
  
  xhr.onerror = function() {
    console.error("Network error while fetching gzipped JSON");
    if (callback) {
      callback(null, new Error("Network error"));
    }
  };
  
  xhr.send();
};




// Safe initialization for Safari
function initSigmaWithGzippedData(containerId, gzippedJsonPath, options, callbackFn) {
  // Make options parameter optional
  if (typeof options === 'function') {
    callbackFn = options;
    options = {};
  }
  
  options = options || {};
  
  // For Safari, use a completely different approach
  if (isSafari) {
    // First, load the data
    loadGzippedGraphData(gzippedJsonPath, function(data, error) {
      if (error || !data) {
        console.error("Failed to load graph data:", error);
        return;
      }
      
      // Wait for DOM to be completely ready
      jQuery(document).ready(function() {
        // Make sure container is ready with dimensions
        var container = document.getElementById(containerId);
        if (!container) {
          console.error("Container not found:", containerId);
          return;
        }
        
        // Ensure container has dimensions
        if (!container.offsetWidth || !container.offsetHeight) {
          container.style.width = container.style.width || "100%";
          container.style.height = container.style.height || "500px";
          container.style.display = "block";
        }
        
        // Wait for next animation frame to ensure DOM updates
        requestAnimationFrame(function() {
          // Create settings with explicit container reference
          var sigmaSettings = Object.assign({}, options);
          
          // Wait a bit more for Safari
          setTimeout(function() {
            try {
              // Initialize sigma with empty graph first
              var sigmaInstance = new sigma(containerId);
              
              // Add nodes and edges manually
              for (var i = 0; i < data.nodes.length; i++) {
                var id = data.nodes[i].id;
                sigmaInstance.addNode(id, data.nodes[i]);
              }
              
              for (var j = 0; j < data.edges.length; j++) {
                var edgeNode = data.edges[j];
                var source = edgeNode.source;
                var target = edgeNode.target;
                var label = edgeNode.label || "";
                var eid = edgeNode.id;
                
                sigmaInstance.addEdge(eid, source, target, edgeNode);
              }
              
              // Refresh the graph
              sigmaInstance.refresh();
              
              // Call user callback if provided
              if (callbackFn) {
                callbackFn(sigmaInstance);
              }
            } catch (e) {
              console.error("Error initializing sigma:", e);
            }
          }, 300); // Longer delay for Safari
        });
      });
    });
  } else {
    // For Chrome and others, use a more standard approach
    jQuery(document).ready(function() {
      try {
        var sigmaInstance = new sigma(containerId);
        sigmaInstance.parseGzippedJson(gzippedJsonPath, function() {
          this.refresh();
          if (callbackFn) callbackFn(this);
        });
      } catch (e) {
        console.error("Error initializing sigma:", e);
      }
    });
  }
}