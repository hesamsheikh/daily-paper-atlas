# Daily Paper Atlas

A visualization tool for exploring papers and authors network graphs, inspired by the [Model Atlas](https://arxiv.org/abs/2503.10633) paper.

## Features

- Interactive graph visualization of papers and authors
- Search functionality to find specific nodes
- Color coding by node attributes
- Group filtering
- Node details panel
- Responsive zoom and navigation

## Setup

1. Convert your GRAPHML file to JSON format:

```bash
python graphml_to_json.py graph.graphml paper_atlas_data.json paper_atlas_data.json.gz
```

2. Start the web server:

```bash
python app.py
```

3. Open your browser to http://localhost:7860

## Technology Stack

- Python for server and data processing
- SigmaJS for graph visualization
- jQuery for DOM manipulation
- Pako.js for client-side decompression
- HTML/CSS for the interface

## Data Format

The application expects a GraphML file that will be converted to a JSON format suitable for SigmaJS. The GraphML file should include node attributes like:
- label
- type (e.g., "author", "paper")
- x, y (coordinates for positioning)
- size
- r, g, b (color values)

## Credits

This visualization is inspired by the work described in ["Charting and Navigating Hugging Face's Model Atlas"](https://arxiv.org/abs/2503.10633) by Eliahu Horwitz, Nitzan Kurer, Jonathan Kahana, Liel Amar, and Yedid Hoshen. 