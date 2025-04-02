import os
import json
import requests
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse


class RequestHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/":
            self.path = "index.html"

            return SimpleHTTPRequestHandler.do_GET(self)

        else:
            return SimpleHTTPRequestHandler.do_GET(self)


print("Starting server on port 7860... Open http://localhost:7860 in your browser")
server = ThreadingHTTPServer(("", 7860), RequestHandler)
server.serve_forever() 