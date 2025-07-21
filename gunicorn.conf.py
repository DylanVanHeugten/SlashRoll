# Gunicorn configuration file
import multiprocessing

# Server socket
backlog = 2048

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "sync"
worker_connections = 1000
timeout = 30
keepalive = 2

# Restart workers after this many requests, to prevent memory leaks
max_requests = 1000
max_requests_jitter = 50

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"

# Process naming
proc_name = "slashroll"

# Server mechanics
preload_app = True
pidfile = "/tmp/slashroll.pid"

# SSL (uncomment for HTTPS)
# keyfile = "/path/to/private.key"
# certfile = "/path/to/certificate.crt"


def when_ready(server):
    server.log.info("SlashRoll server is ready. Listening on: %s", server.address)


def worker_int(worker):
    worker.log.info("worker received INT or QUIT signal")


def pre_fork(server, worker):
    server.log.info("Worker spawned (pid: %s)", worker.pid)


def post_fork(server, worker):
    server.log.info("Worker spawned (pid: %s)", worker.pid)
