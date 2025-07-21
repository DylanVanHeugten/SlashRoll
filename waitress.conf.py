# Waitress configuration for Windows production deployment
import os
from waitress import serve
from wsgi import app

def run_waitress():
    """
    Run the application using Waitress WSGI server.
    Waitress is a pure-Python WSGI server that works on Windows.
    """
    # Get configuration from environment variables
    host = os.getenv('WAITRESS_HOST', '0.0.0.0')
    port = int(os.getenv('WAITRESS_PORT', '8000'))
    threads = int(os.getenv('WAITRESS_THREADS', '6'))
    
    print(f"Starting SlashRoll with Waitress on {host}:{port}")
    print(f"Using {threads} threads")
    
    serve(
        app,
        host=host,
        port=port,
        threads=threads,
        connection_limit=1000,
        cleanup_interval=30,
        channel_timeout=120,
        log_socket_errors=True,
        # Security settings
        expose_tracebacks=False,
        ident='SlashRoll'
    )

if __name__ == '__main__':
    run_waitress()