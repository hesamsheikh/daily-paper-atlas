# Daily Papers Atlas

The atlas visualization demo of the daily papers listed in [Hugging Face Daily Papers](https://huggingface.co/papers). 

## Features

- Interactive graph visualization of papers and authors
- Search functionality to find specific nodes
- Color coding by node attributes
- Group filtering
- Node details panel
- Responsive zoom and navigation

## Project Structure

- `data/` - Contains all data files and conversion scripts
  - `graph.graphml` - Source GraphML file
  - `graph.json` - Intermediate JSON format
  - `sigma_graph.json` - SigmaJS-compatible JSON
  - `paper_atlas_data.json` - Additional data
  - `paper_atlas_data.json.gz` - Compressed data
  - `graphml_to_json.py` - GraphML to JSON converter
  - `json_converter.js` - JSON format converter
  - `check_json.py` - JSON validation script
- `js/` - JavaScript files
- `css/` - CSS stylesheets
- `config.json` - Application configuration
- `index.html` - Main application page
- `app.py` - Simple web server

## Setup and Running the Application

### Data Conversion

If you need to convert a GraphML file to JSON:

```bash
# Convert GraphML to JSON
python data/graphml_to_json.py data/graph.graphml data/paper_atlas_data.json data/paper_atlas_data.json.gz
```

To convert the intermediate JSON to SigmaJS format:

```bash
# Convert to SigmaJS format
node data/json_converter.js
```

### Running the Application

Start the local web server:

```bash
# Start the web server
python app.py
```

Then open your browser to http://localhost:7860

## Technology Stack

- Python for server and data processing
- SigmaJS for graph visualization
- jQuery for DOM manipulation
- Pako.js for client-side decompression
- HTML/CSS for the interface

## Data Format

The data is exported from [Gephi](https://gephi.org/) in the GraphML/JSON format.

## Configuration

The `config.json` file controls various aspects of the visualization:
- Data source path
- Node colors and sizes
- UI text and labels
- Sigma.js visualization settings

## Credits

This visualization is inspired by the work described in ["Charting and Navigating Hugging Face's Model Atlas"](https://arxiv.org/abs/2503.10633). 