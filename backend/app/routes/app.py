from flask import Flask
from flask_cors import CORS
import os

from app.routes.auth import bp_auth
from app.routes.auth_jobber import auth_jobber_bp
from app.routes.workers import workers_bp
from app.routes.time_entries import time_entries_bp
from app.routes.time_off import time_off_bp

import app.models  # ensure models are registered with Base


def create_app() -> Flask:
    flask_app = Flask(__name__)
    CORS(flask_app, resources={r"/api/*": {"origins": os.environ.get("FRONTEND_URL", "*")}})

    flask_app.register_blueprint(bp_auth())
    flask_app.register_blueprint(auth_jobber_bp)
    flask_app.register_blueprint(workers_bp)
    flask_app.register_blueprint(time_entries_bp)
    flask_app.register_blueprint(time_off_bp)

    return flask_app


app = create_app()
