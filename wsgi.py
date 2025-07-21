#!/usr/bin/env python3
"""
WSGI entry point for SlashRoll application.
Used by Gunicorn and other WSGI servers.
"""

import os
from app import app

if __name__ == "__main__":
    app.run()