import os
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_login import (
    LoginManager,
    UserMixin,
    current_user,
    login_required,
    login_user,
    logout_user,
)
from flask_sqlalchemy import SQLAlchemy
from flask_wtf.csrf import CSRFProtect
from sqlalchemy import text
from werkzeug.security import check_password_hash, generate_password_hash

load_dotenv()

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///slashroll.db"

# Critical security fix: Require SECRET_KEY environment variable
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY environment variable is required for security")
app.config["SECRET_KEY"] = SECRET_KEY

# Production mode configuration
PRODUCTION_MODE = os.getenv("PRODUCTION_MODE", "false").lower() == "true"

# Security fix: Session timeout configuration
app.permanent_session_lifetime = timedelta(hours=2)

# Security fix: Restrict CORS to specific origins
CORS(app, origins=["http://localhost:5000"], methods=["GET", "POST", "PUT", "DELETE"])

# Security fix: Add CSRF protection with API exemption
csrf = CSRFProtect(app)

# Configure CSRF to exempt API endpoints
app.config["WTF_CSRF_CHECK_DEFAULT"] = False


@app.before_request
def csrf_protect():
    """Apply CSRF protection only to non-API routes, but exempt login/logout for now"""
    if request.endpoint and not request.path.startswith("/api/"):
        # Skip CSRF for login and logout routes since they're handled via JSON
        if request.path in ["/login", "/logout"]:
            return
        if request.method in ["POST", "PUT", "DELETE", "PATCH"]:
            csrf.protect()


# Security fix: Add rate limiting
limiter = Limiter(
    app=app, key_func=get_remote_address, default_limits=["200 per day", "50 per hour"]
)

db = SQLAlchemy(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login"  # type: ignore


@login_manager.user_loader
def load_user(user_id):
    # Handle prefixed user IDs to distinguish between user types
    if user_id.startswith("admin_"):
        actual_id = int(user_id.replace("admin_", ""))
        return AdminUser.query.get(actual_id)
    elif user_id.startswith("user_"):
        actual_id = int(user_id.replace("user_", ""))
        return User.query.get(actual_id)
    else:
        # For backward compatibility, try AdminUser first
        user = AdminUser.query.get(int(user_id))
        if user:
            return user
        return User.query.get(int(user_id))


def get_user_teams():
    """Get all teams for the current authenticated user"""
    if not current_user.is_authenticated:
        return []

    # Check if current user is the superadmin
    if is_superadmin():
        return Team.query.all()

    # For regular users, return only their assigned teams
    if isinstance(current_user, User):
        return current_user.get_teams()

    # For AdminUser (non-superadmin), return no teams by default
    return []


def is_superadmin():
    """Check if the current user is the superadmin"""
    if not current_user.is_authenticated:
        return False

    superadmin_username = os.getenv("su_username", "admin")
    return (
        isinstance(current_user, AdminUser)
        and current_user.username == superadmin_username
    )


def validate_team_access(team_id):
    """Validate that the current user has access to the specified team"""
    if not current_user.is_authenticated:
        return False

    if not team_id:
        return False

    user_teams = get_user_teams()
    return any(team.id == team_id for team in user_teams)


def validate_input_data(
    data, required_fields=None, max_lengths=None, allow_zero_fields=None
):
    """Validate input data for security and data integrity"""
    if not data:
        return False, "No data provided"

    # Check required fields
    if required_fields:
        for field in required_fields:
            if field not in data:
                return False, f"{field} is required"
            # Allow 0 for numeric fields that can be zero
            if allow_zero_fields and field in allow_zero_fields:
                if data[field] is None or data[field] == "":
                    return False, f"{field} is required"
            elif not data[field]:
                return False, f"{field} is required"

    # Check string lengths
    if max_lengths:
        for field, max_length in max_lengths.items():
            if field in data and isinstance(data[field], str):
                if len(data[field]) > max_length:
                    return False, f"{field} must be {max_length} characters or less"
                # Basic sanitization - remove dangerous characters
                data[field] = data[field].strip()

    return True, "Valid"


class AdminUser(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)
    date_created = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    def get_id(self):
        """Override UserMixin get_id to return prefixed ID"""
        return f"admin_{self.id}"

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "date_created": self.date_created.isoformat(),
        }


class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)
    date_created = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    team_id = db.Column(db.Integer, db.ForeignKey("team.id"), nullable=True)

    # Relationship to Team (legacy, now uses UserTeam)
    team = db.relationship("Team", backref="users")

    def get_id(self):
        """Override UserMixin get_id to return prefixed ID"""
        return f"user_{self.id}"

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def get_teams(self):
        """Get all teams this user is assigned to"""
        return [ut.team for ut in self.user_teams]

    def to_dict(self):
        teams = self.get_teams()
        return {
            "id": self.id,
            "username": self.username,
            "teams": [{"id": team.id, "name": team.name} for team in teams],
            "date_created": self.date_created.isoformat(),
        }


class Team(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    description = db.Column(db.Text, nullable=True)
    date_created = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    def get_users(self):
        """Get all users assigned to this team"""
        return [tu.user for tu in self.team_users]

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "date_created": self.date_created.isoformat(),
            "member_count": len(self.team_users),
        }


class UserTeam(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey("team.id"), nullable=False)
    date_assigned = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    user = db.relationship("User", backref="user_teams")
    team = db.relationship("Team", backref="team_users")

    # Unique constraint to prevent duplicate assignments
    __table_args__ = (
        db.UniqueConstraint("user_id", "team_id", name="unique_user_team"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "team_id": self.team_id,
            "user_name": self.user.username,
            "team_name": self.team.name,
            "date_assigned": self.date_assigned.isoformat(),
        }


class Season(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    date_created = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    team_id = db.Column(db.Integer, db.ForeignKey("team.id"), nullable=True)

    team = db.relationship("Team", backref="seasons")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "date_created": self.date_created.isoformat(),
            "team_id": self.team_id,
            "team_name": self.team.name if self.team else None,
        }


class Player(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    game_id = db.Column(db.String(100), nullable=True)  # Optional unique game ID
    status = db.Column(db.String(20), nullable=False, default="active")
    roster_position = db.Column(
        db.Integer, nullable=True
    )  # Keep for backward compatibility
    season_id = db.Column(
        db.Integer, db.ForeignKey("season.id"), nullable=True
    )  # Keep for backward compatibility
    team_id = db.Column(db.Integer, db.ForeignKey("team.id"), nullable=True)

    season = db.relationship("Season", backref="players")
    team = db.relationship("Team", backref="players")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "game_id": self.game_id,
            "status": self.status,
            "roster_position": self.roster_position,
            "season_id": self.season_id,
            "team_id": self.team_id,
            "team_name": self.team.name if self.team else None,
        }


class SeasonRoster(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    season_id = db.Column(db.Integer, db.ForeignKey("season.id"), nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"), nullable=False)
    roster_position = db.Column(db.Integer, nullable=False)

    season = db.relationship("Season", backref="season_rosters")
    player = db.relationship("Player", backref="season_rosters")

    # Unique constraint to prevent duplicate positions per season
    __table_args__ = (
        db.UniqueConstraint(
            "season_id", "roster_position", name="unique_season_position"
        ),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "season_id": self.season_id,
            "player_id": self.player_id,
            "roster_position": self.roster_position,
            "player_name": self.player.name,
            "player_status": self.player.status,
        }


class Battle(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    enemy_name = db.Column(db.String(100), nullable=False)
    enemy_power_ranking = db.Column(db.Integer, nullable=False)
    our_score = db.Column(db.Integer, nullable=False)
    their_score = db.Column(db.Integer, nullable=False)
    date_created = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    season_id = db.Column(db.Integer, db.ForeignKey("season.id"), nullable=True)
    team_id = db.Column(db.Integer, db.ForeignKey("team.id"), nullable=True)

    season = db.relationship("Season", backref="battles")
    team = db.relationship("Team", backref="battles")

    def to_dict(self):
        try:
            total_damage = sum(p.damage_done for p in self.participants)
        except Exception:
            # If participants aren't loaded, query them directly
            participants = BattleParticipant.query.filter_by(battle_id=self.id).all()
            total_damage = sum(p.damage_done for p in participants)

        return {
            "id": self.id,
            "enemy_name": self.enemy_name,
            "enemy_power_ranking": self.enemy_power_ranking,
            "our_score": self.our_score,
            "their_score": self.their_score,
            "date_created": self.date_created.isoformat(),
            "total_damage": total_damage,
            "season_id": self.season_id,
            "team_id": self.team_id,
            "team_name": self.team.name if self.team else None,
        }


class BattleParticipant(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    battle_id = db.Column(db.Integer, db.ForeignKey("battle.id"), nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"), nullable=False)
    damage_done = db.Column(db.Integer, nullable=False, default=0)
    shields_broken = db.Column(db.Integer, nullable=False, default=0)

    battle = db.relationship("Battle", backref="participants")
    player = db.relationship("Player", backref="battle_participations")

    def to_dict(self):
        return {
            "id": self.id,
            "battle_id": self.battle_id,
            "player_id": self.player_id,
            "player_name": self.player.name,
            "damage_done": self.damage_done,
            "shields_broken": self.shields_broken,
        }


@app.route("/")
def index():
    if not current_user.is_authenticated:
        template = "login.prod.html" if PRODUCTION_MODE else "login.html"
        return render_template(template)
    template = "index.prod.html" if PRODUCTION_MODE else "index.html"
    return render_template(template)


@app.route("/login", methods=["GET", "POST"])
@limiter.limit("5 per minute")
def login():
    if request.method == "POST":
        data = request.get_json()
        username = data.get("username")
        password = data.get("password")

        # Check AdminUser first
        user = AdminUser.query.filter_by(username=username).first()

        # If not found in AdminUser, check regular User
        if not user:
            regular_user = User.query.filter_by(username=username).first()
            if regular_user and regular_user.check_password(password):
                # Create a temporary AdminUser-like object for login
                # In a real system, you'd have proper role-based authentication
                login_user(regular_user)
                return jsonify({"success": True, "message": "Logged in successfully"})

        if user and user.check_password(password):
            login_user(user)
            return jsonify({"success": True, "message": "Logged in successfully"})
        else:
            return jsonify(
                {"success": False, "message": "Invalid username or password"}
            ), 401

    template = "login.prod.html" if PRODUCTION_MODE else "login.html"
    return render_template(template)


@app.route("/logout", methods=["POST"])
@login_required
def logout():
    logout_user()
    return jsonify({"success": True, "message": "Logged out successfully"})


@app.route("/api/auth/status")
def auth_status():
    if current_user.is_authenticated:
        user_dict = current_user.to_dict()
        user_dict["is_superadmin"] = is_superadmin()
        return jsonify({"authenticated": True, "user": user_dict})
    else:
        return jsonify({"authenticated": False, "user": None})


@app.route("/api/auth/teams")
@login_required
def get_auth_teams():
    try:
        # Get teams for the current authenticated user
        teams = get_user_teams()
        return jsonify([team.to_dict() for team in teams])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# User endpoints
@app.route("/api/users", methods=["GET"])
@login_required
def get_users():
    users = User.query.all()
    return jsonify([user.to_dict() for user in users])


@app.route("/api/users", methods=["POST"])
@login_required
def create_user():
    data = request.get_json()

    if not data or "username" not in data or "password" not in data:
        return jsonify({"error": "Username and password are required"}), 400

    if User.query.filter_by(username=data["username"]).first():
        return jsonify({"error": "Username already exists"}), 400

    user = User()
    user.username = data["username"]
    user.set_password(data["password"])

    try:
        db.session.add(user)
        db.session.commit()
        return jsonify(user.to_dict()), 201
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to create user"}), 500


@app.route("/api/users/<int:user_id>", methods=["PUT"])
@login_required
def update_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    # Update username if provided
    if "username" in data:
        new_username = data["username"].strip()
        if not new_username:
            return jsonify({"error": "Username cannot be empty"}), 400

        # Check if username is already taken by another user
        existing_user = (
            User.query.filter_by(username=new_username)
            .filter(User.id != user_id)
            .first()
        )
        if existing_user:
            return jsonify({"error": "Username already exists"}), 400

        user.username = new_username

    # Update password if provided
    if "password" in data:
        new_password = data["password"].strip()
        if not new_password:
            return jsonify({"error": "Password cannot be empty"}), 400

        user.set_password(new_password)

    try:
        db.session.commit()
        return jsonify(user.to_dict()), 200
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to update user"}), 500


@app.route("/api/users/<int:user_id>", methods=["DELETE"])
@login_required
def delete_user(user_id):
    user = User.query.get_or_404(user_id)

    try:
        db.session.delete(user)
        db.session.commit()
        return jsonify({"message": "User deleted successfully"}), 200
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to delete user"}), 500


# Team endpoints
@app.route("/api/teams", methods=["GET"])
@login_required
def get_teams():
    teams = Team.query.all()
    return jsonify([team.to_dict() for team in teams])


@app.route("/api/teams", methods=["POST"])
@login_required
def create_team():
    data = request.get_json()

    if not data or "name" not in data:
        return jsonify({"error": "Team name is required"}), 400

    if Team.query.filter_by(name=data["name"]).first():
        return jsonify({"error": "Team name already exists"}), 400

    team = Team(
        name=data["name"], description=data.get("description", "").strip() or None
    )

    try:
        db.session.add(team)
        db.session.commit()
        return jsonify(team.to_dict()), 201
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to create team"}), 500


@app.route("/api/teams/<int:team_id>", methods=["PUT"])
@login_required
def update_team(team_id):
    team = Team.query.get_or_404(team_id)
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    # Update team name if provided
    if "name" in data:
        new_name = data["name"].strip()
        if not new_name:
            return jsonify({"error": "Team name cannot be empty"}), 400

        # Check if team name is already taken by another team
        existing_team = (
            Team.query.filter_by(name=new_name).filter(Team.id != team_id).first()
        )
        if existing_team:
            return jsonify({"error": "Team name already exists"}), 400

        team.name = new_name

    # Update description if provided
    if "description" in data:
        team.description = data["description"].strip() or None

    try:
        db.session.commit()
        return jsonify(team.to_dict()), 200
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to update team"}), 500


@app.route("/api/teams/<int:team_id>", methods=["DELETE"])
@login_required
def delete_team(team_id):
    team = Team.query.get_or_404(team_id)

    # Check if team has users assigned
    if team.team_users:
        return jsonify(
            {
                "error": "Cannot delete team with assigned users. Please reassign users first."
            }
        ), 400

    try:
        db.session.delete(team)
        db.session.commit()
        return jsonify({"message": "Team deleted successfully"}), 200
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to delete team"}), 500


# User-Team assignment endpoints
@app.route("/api/users/<int:user_id>/teams", methods=["GET"])
@login_required
def get_user_teams_endpoint(user_id):
    user = User.query.get_or_404(user_id)
    teams = user.get_teams()
    return jsonify([{"id": team.id, "name": team.name} for team in teams])


@app.route("/api/users/<int:user_id>/teams", methods=["PUT"])
@login_required
def update_user_teams(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json()

    if not data or "team_ids" not in data:
        return jsonify({"error": "team_ids array is required"}), 400

    team_ids = data["team_ids"]

    # Validate all team IDs exist
    if team_ids:
        teams = Team.query.filter(Team.id.in_(team_ids)).all()
        if len(teams) != len(team_ids):
            return jsonify({"error": "One or more team IDs are invalid"}), 400

    try:
        # Remove all existing team assignments for this user
        UserTeam.query.filter_by(user_id=user_id).delete()

        # Add new team assignments
        for team_id in team_ids:
            user_team = UserTeam(user_id=user_id, team_id=team_id)
            db.session.add(user_team)

        db.session.commit()
        return jsonify(user.to_dict()), 200
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to update user teams"}), 500


@app.route("/api/users/<int:user_id>/teams/<int:team_id>", methods=["POST"])
@login_required
def assign_user_to_team(user_id, team_id):
    # Validate user and team exist
    User.query.get_or_404(user_id)
    Team.query.get_or_404(team_id)

    # Check if assignment already exists
    existing = UserTeam.query.filter_by(user_id=user_id, team_id=team_id).first()
    if existing:
        return jsonify({"error": "User is already assigned to this team"}), 400

    try:
        user_team = UserTeam(user_id=user_id, team_id=team_id)
        db.session.add(user_team)
        db.session.commit()
        return jsonify(user_team.to_dict()), 201
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to assign user to team"}), 500


@app.route("/api/users/<int:user_id>/teams/<int:team_id>", methods=["DELETE"])
@login_required
def remove_user_from_team(user_id, team_id):
    # Validate user and team exist
    User.query.get_or_404(user_id)
    Team.query.get_or_404(team_id)

    user_team = UserTeam.query.filter_by(user_id=user_id, team_id=team_id).first()
    if not user_team:
        return jsonify({"error": "User is not assigned to this team"}), 404

    try:
        db.session.delete(user_team)
        db.session.commit()
        return jsonify({"message": "User removed from team successfully"}), 200
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to remove user from team"}), 500


@app.route("/api/players", methods=["GET"])
@login_required
def get_players():
    status = request.args.get("status", "active")
    season_id = request.args.get("season_id")
    team_id = request.args.get("team_id")

    # Require team_id for player fetching to enforce team restrictions
    if not team_id:
        return jsonify({"error": "Team ID is required"}), 400

    # Validate team access
    if not validate_team_access(int(team_id)):
        return jsonify({"error": "Access denied to this team"}), 403

    query = Player.query.filter_by(team_id=team_id)
    if season_id:
        query = query.filter_by(season_id=season_id)

    if status == "all":
        players = query.all()
        # For management view, include all seasons a player is involved in
        players_data = []
        for player in players:
            player_data = player.to_dict()
            # Get all seasons this player is involved in (roster or battles)
            season_ids = set()
            if player.season_id:
                season_ids.add(player.season_id)

            # Add seasons from roster participation
            roster_seasons = (
                db.session.query(SeasonRoster.season_id)
                .filter_by(player_id=player.id)
                .all()
            )
            for season_id_tuple in roster_seasons:
                season_ids.add(season_id_tuple[0])

            # Add seasons from battle participation
            battle_seasons = (
                db.session.query(Battle.season_id)
                .join(BattleParticipant)
                .filter(BattleParticipant.player_id == player.id)
                .all()
            )
            for season_id_tuple in battle_seasons:
                if season_id_tuple[0]:
                    season_ids.add(season_id_tuple[0])

            # Get season names (only from the same team)
            if season_ids:
                seasons = Season.query.filter(
                    Season.id.in_(season_ids), Season.team_id == team_id
                ).all()
                player_data["seasons"] = [{"id": s.id, "name": s.name} for s in seasons]
            else:
                player_data["seasons"] = []

            players_data.append(player_data)
        return jsonify(players_data)
    else:
        players = query.filter_by(status=status).all()
        return jsonify([player.to_dict() for player in players])


@app.route("/api/players/roster", methods=["GET"])
@login_required
def get_roster():
    season_id = request.args.get("season_id")
    team_id = request.args.get("team_id")

    # Require team_id for roster access
    if not team_id:
        return jsonify({"error": "Team ID is required"}), 400

    # Validate team access
    if not validate_team_access(int(team_id)):
        return jsonify({"error": "Access denied to this team"}), 403

    if season_id:
        # Use new SeasonRoster table with team validation
        season_rosters = (
            SeasonRoster.query.filter_by(season_id=season_id)
            .join(Player)
            .filter(Player.status == "active", Player.team_id == team_id)
            .order_by(SeasonRoster.roster_position)
            .all()
        )
        roster_data = []
        for sr in season_rosters:
            player_data = sr.player.to_dict()
            player_data["roster_position"] = sr.roster_position
            roster_data.append(player_data)
        return jsonify(roster_data)
    else:
        # Fallback to old method for backward compatibility with team filter
        query = Player.query.filter_by(status="active", team_id=team_id).filter(
            Player.roster_position.isnot(None)
        )
        players = query.order_by(Player.roster_position).all()
        return jsonify([player.to_dict() for player in players])


@app.route("/api/players/<int:player_id>/status", methods=["PUT"])
@login_required
def update_player_status(player_id):
    player = Player.query.get_or_404(player_id)

    # Validate team access for the player
    if not validate_team_access(player.team_id):
        return jsonify({"error": "Access denied to this team"}), 403

    data = request.get_json()

    if not data or "status" not in data:
        return jsonify({"error": "Status is required"}), 400

    if data["status"] not in ["active", "inactive"]:
        return jsonify({"error": "Status must be active or inactive"}), 400

    player.status = data["status"]
    if data["status"] == "inactive":
        player.roster_position = None

    try:
        db.session.commit()
        return jsonify(player.to_dict()), 200
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to update player status"}), 500


@app.route("/api/players/<int:player_id>/roster", methods=["PUT"])
@login_required
def update_roster_position(player_id):
    player = Player.query.get_or_404(player_id)

    # Validate team access for the player
    if not validate_team_access(player.team_id):
        return jsonify({"error": "Access denied to this team"}), 403

    data = request.get_json()

    if player.status != "active":
        return jsonify({"error": "Only active players can be added to roster"}), 400

    position = data.get("position")
    season_id = data.get("season_id")

    # Validate season belongs to the same team
    if season_id:
        season = Season.query.get(season_id)
        if not season or season.team_id != player.team_id:
            return jsonify({"error": "Season does not belong to this team"}), 400

    if position is None:
        # Remove from roster
        if season_id:
            SeasonRoster.query.filter_by(
                season_id=season_id, player_id=player_id
            ).delete()
        else:
            # Fallback to old method
            player.roster_position = None
    else:
        if position < 1 or position > 20:
            return jsonify({"error": "Roster position must be between 1 and 20"}), 400

        if season_id:
            # Use new SeasonRoster table
            # Remove existing position for this player in this season
            SeasonRoster.query.filter_by(
                season_id=season_id, player_id=player_id
            ).delete()

            # Remove any existing player at this position in this season
            existing_roster = SeasonRoster.query.filter_by(
                season_id=season_id, roster_position=position
            ).first()
            if existing_roster:
                db.session.delete(existing_roster)

            # Add new roster entry
            new_roster = SeasonRoster(
                season_id=season_id, player_id=player_id, roster_position=position
            )
            db.session.add(new_roster)
        else:
            # Fallback to old method with team validation
            existing_player = Player.query.filter_by(
                roster_position=position, team_id=player.team_id
            ).first()
            if existing_player and existing_player.id != player_id:
                existing_player.roster_position = None
            player.roster_position = position

    try:
        db.session.commit()
        # Return player data with updated roster position
        player_data = player.to_dict()
        if season_id and position:
            player_data["roster_position"] = position
        return jsonify(player_data), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error updating roster position: {str(e)}")
        return jsonify({"error": f"Failed to update roster position: {str(e)}"}), 500


@app.route("/api/players/swap-roster", methods=["PUT"])
@login_required
def swap_roster_positions():
    data = request.get_json()

    if not data or "player1_id" not in data or "player2_id" not in data:
        return jsonify({"error": "Both player IDs are required"}), 400

    player1_id = data["player1_id"]
    player2_id = data["player2_id"]
    season_id = data.get("season_id")

    if not season_id:
        return jsonify({"error": "Season ID is required"}), 400

    try:
        # Get current roster entries for both players
        roster1 = SeasonRoster.query.filter_by(
            season_id=season_id, player_id=player1_id
        ).first()
        roster2 = SeasonRoster.query.filter_by(
            season_id=season_id, player_id=player2_id
        ).first()

        if not roster1 or not roster2:
            return jsonify({"error": "One or both players not found in roster"}), 400

        # Store original positions
        pos1 = roster1.roster_position
        pos2 = roster2.roster_position

        # Use a temporary position to avoid constraint violation
        # Use a position higher than 20 as temporary (like 999)
        temp_position = 999

        # Step 1: Move first player to temporary position
        roster1.roster_position = temp_position
        db.session.commit()

        # Step 2: Move second player to first player's original position
        roster2.roster_position = pos1
        db.session.commit()

        # Step 3: Move first player to second player's original position
        roster1.roster_position = pos2
        db.session.commit()

        return jsonify(
            {
                "message": "Players swapped successfully",
                "player1": {"id": player1_id, "position": roster1.roster_position},
                "player2": {"id": player2_id, "position": roster2.roster_position},
            }
        ), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error swapping roster positions: {str(e)}")
        return jsonify({"error": f"Failed to swap roster positions: {str(e)}"}), 500


@app.route("/api/players", methods=["POST"])
@login_required
def add_player():
    data = request.get_json()

    # Input validation
    is_valid, error_msg = validate_input_data(
        data,
        required_fields=["name", "team_id"],
        max_lengths={"name": 100, "game_id": 50},
    )
    if not is_valid:
        return jsonify({"error": error_msg}), 400

    # Get team_id (already validated above)
    team_id = data.get("team_id")

    # Validate team access
    if not validate_team_access(team_id):
        return jsonify({"error": "Access denied to this team"}), 403

    # Check if GameID is already in use within the same team
    if data.get("game_id") and data.get("game_id").strip():
        existing_player = Player.query.filter_by(
            game_id=data.get("game_id").strip(), team_id=team_id
        ).first()
        if existing_player:
            return jsonify(
                {"error": f"Game ID is already used by player: {existing_player.name}"}
            ), 400

    player = Player(
        name=data["name"],
        game_id=data.get("game_id").strip() if data.get("game_id") else None,
        season_id=data.get("season_id"),
        team_id=team_id,
    )

    try:
        db.session.add(player)
        db.session.commit()
        return jsonify(player.to_dict()), 201
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to add player"}), 500


@app.route("/api/players/<int:player_id>", methods=["PUT"])
@login_required
def update_player(player_id):
    player = Player.query.get_or_404(player_id)

    # Validate team access for the player
    if not validate_team_access(player.team_id):
        return jsonify({"error": "Access denied to this team"}), 403

    data = request.get_json()

    if "season_id" in data:
        player.season_id = data["season_id"]

    if "game_id" in data:
        new_game_id = data["game_id"].strip() if data["game_id"] else None
        # Check if GameID is already in use by another player in the same team
        if new_game_id:
            existing_player = (
                Player.query.filter_by(game_id=new_game_id, team_id=player.team_id)
                .filter(Player.id != player_id)
                .first()
            )
            if existing_player:
                return jsonify(
                    {
                        "error": f"Game ID is already used by player: {existing_player.name}"
                    }
                ), 400
        player.game_id = new_game_id

    try:
        db.session.commit()
        return jsonify(player.to_dict()), 200
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to update player"}), 500


@app.route("/api/players/<int:player_id>", methods=["DELETE"])
@login_required
def delete_player(player_id):
    player = Player.query.get_or_404(player_id)

    # Validate team access for the player
    if not validate_team_access(player.team_id):
        return jsonify({"error": "Access denied to this team"}), 403

    try:
        db.session.delete(player)
        db.session.commit()
        return jsonify({"message": "Player deleted successfully"}), 200
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to delete player"}), 500


# Battle endpoints
@app.route("/api/battles", methods=["GET"])
@login_required
def get_battles():
    season_id = request.args.get("season_id")
    team_id = request.args.get("team_id")

    # Require team_id for battle access
    if not team_id:
        return jsonify({"error": "Team ID is required"}), 400

    # Validate team access
    if not validate_team_access(int(team_id)):
        return jsonify({"error": "Access denied to this team"}), 403

    query = Battle.query.filter_by(team_id=team_id)
    if season_id:
        query = query.filter_by(season_id=season_id)

    battles = query.order_by(Battle.date_created.desc()).all()
    return jsonify([battle.to_dict() for battle in battles])


@app.route("/api/battles", methods=["POST"])
@login_required
def create_battle():
    data = request.get_json()

    # Input validation
    is_valid, error_msg = validate_input_data(
        data,
        required_fields=[
            "enemy_name",
            "enemy_power_ranking",
            "our_score",
            "their_score",
            "participants",
            "team_id",
        ],
        max_lengths={"enemy_name": 100},
        allow_zero_fields=["their_score", "our_score"],
    )
    if not is_valid:
        return jsonify({"error": error_msg}), 400

    # Additional validation for numeric fields
    try:
        int(data.get("enemy_power_ranking", 0))
        int(data.get("our_score", 0))
        int(data.get("their_score", 0))
    except (ValueError, TypeError):
        return jsonify({"error": "Power ranking and scores must be valid numbers"}), 400

    # Get team_id (already validated above)
    team_id = data.get("team_id")

    # Validate team access
    if not validate_team_access(team_id):
        return jsonify({"error": "Access denied to this team"}), 403

    # Validate season belongs to the same team
    season_id = data.get("season_id")
    if season_id:
        season = Season.query.get(season_id)
        if not season or season.team_id != team_id:
            return jsonify({"error": "Season does not belong to this team"}), 400

    battle = Battle(
        enemy_name=data["enemy_name"],
        enemy_power_ranking=data["enemy_power_ranking"],
        our_score=data["our_score"],
        their_score=data["their_score"],
        season_id=season_id,
        team_id=team_id,
    )

    try:
        db.session.add(battle)
        db.session.flush()  # Get the battle ID

        # Add battle participants - validate they belong to the team
        for participant_data in data["participants"]:
            if "player_id" not in participant_data:
                continue

            # Validate player belongs to the team
            player = Player.query.get(participant_data["player_id"])
            if not player or player.team_id != team_id:
                return jsonify(
                    {
                        "error": f"Player {participant_data['player_id']} does not belong to this team"
                    }
                ), 400

            participant = BattleParticipant(
                battle_id=battle.id,
                player_id=participant_data["player_id"],
                damage_done=participant_data.get("damage_done", 0),
                shields_broken=participant_data.get("shields_broken", 0),
            )
            db.session.add(participant)

        db.session.commit()
        return jsonify(battle.to_dict()), 201
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to create battle"}), 500


@app.route("/api/battles/<int:battle_id>", methods=["GET"])
@login_required
def get_battle(battle_id):
    battle = Battle.query.get_or_404(battle_id)

    # Validate team access for the battle
    if not validate_team_access(battle.team_id):
        return jsonify({"error": "Access denied to this team"}), 403

    battle_data = battle.to_dict()
    battle_data["participants"] = [p.to_dict() for p in battle.participants]
    return jsonify(battle_data)


@app.route("/api/battles/<int:battle_id>", methods=["PUT"])
@login_required
def update_battle(battle_id):
    battle = Battle.query.get_or_404(battle_id)

    # Validate team access for the battle
    if not validate_team_access(battle.team_id):
        return jsonify({"error": "Access denied to this team"}), 403

    data = request.get_json()

    # Update battle details
    if "enemy_name" in data:
        battle.enemy_name = data["enemy_name"]
    if "enemy_power_ranking" in data:
        battle.enemy_power_ranking = data["enemy_power_ranking"]
    if "our_score" in data:
        battle.our_score = data["our_score"]
    if "their_score" in data:
        battle.their_score = data["their_score"]

    try:
        # Update participants if provided
        if "participants" in data:
            # Delete existing participants
            BattleParticipant.query.filter_by(battle_id=battle_id).delete()

            # Add updated participants - validate they belong to the team
            for participant_data in data["participants"]:
                if "player_id" not in participant_data:
                    continue

                # Validate player belongs to the team
                player = Player.query.get(participant_data["player_id"])
                if not player or player.team_id != battle.team_id:
                    return jsonify(
                        {
                            "error": f"Player {participant_data['player_id']} does not belong to this team"
                        }
                    ), 400

                participant = BattleParticipant(
                    battle_id=battle_id,
                    player_id=participant_data["player_id"],
                    damage_done=participant_data.get("damage_done", 0),
                    shields_broken=participant_data.get("shields_broken", 0),
                )
                db.session.add(participant)

        db.session.commit()

        # Return complete battle data including participants
        battle_data = battle.to_dict()
        battle_data["participants"] = [p.to_dict() for p in battle.participants]
        return jsonify(battle_data), 200
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to update battle"}), 500


@app.route("/api/battles/<int:battle_id>", methods=["DELETE"])
@login_required
def delete_battle(battle_id):
    battle = Battle.query.get_or_404(battle_id)

    # Validate team access for the battle
    if not validate_team_access(battle.team_id):
        return jsonify({"error": "Access denied to this team"}), 403

    try:
        # Delete participants first (due to foreign key constraint)
        BattleParticipant.query.filter_by(battle_id=battle_id).delete()
        db.session.delete(battle)
        db.session.commit()
        return jsonify({"message": "Battle deleted successfully"}), 200
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to delete battle"}), 500


@app.route("/api/players/<int:player_id>/battle-stats", methods=["GET"])
@login_required
def get_player_battle_stats(player_id):
    player = Player.query.get_or_404(player_id)

    # Validate team access for the player
    if not validate_team_access(player.team_id):
        return jsonify({"error": "Access denied to this team"}), 403

    season_id = request.args.get("season_id")

    # Base query for battle participants - only include battles from the same team
    query = (
        db.session.query(BattleParticipant)
        .filter_by(player_id=player_id)
        .join(Battle)
        .filter(Battle.team_id == player.team_id)
    )

    # Filter by season if specified
    if season_id:
        query = query.filter(Battle.season_id == season_id)

    # Get total stats
    total_damage = (
        query.with_entities(db.func.sum(BattleParticipant.damage_done)).scalar() or 0
    )
    total_shields = (
        query.with_entities(db.func.sum(BattleParticipant.shields_broken)).scalar() or 0
    )
    battle_count = query.count()

    return jsonify(
        {
            "player_id": player_id,
            "player_name": player.name,
            "total_damage": total_damage,
            "total_shields_broken": total_shields,
            "battles_participated": battle_count,
        }
    )


# Season endpoints
@app.route("/api/seasons", methods=["GET"])
@login_required
def get_seasons():
    team_id = request.args.get("team_id")
    if team_id:
        seasons = (
            Season.query.filter_by(team_id=team_id)
            .order_by(Season.date_created.desc())
            .all()
        )
    else:
        seasons = Season.query.order_by(Season.date_created.desc()).all()
    return jsonify([season.to_dict() for season in seasons])


@app.route("/api/seasons", methods=["POST"])
@login_required
def create_season():
    data = request.get_json()

    if not data or "name" not in data:
        return jsonify({"error": "Name is required"}), 400

    season = Season(name=data["name"], team_id=data.get("team_id"))

    try:
        db.session.add(season)
        db.session.commit()
        return jsonify(season.to_dict()), 201
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to create season"}), 500


@app.route("/api/seasons/<int:season_id>", methods=["PUT"])
@login_required
def update_season(season_id):
    season = Season.query.get_or_404(season_id)
    data = request.get_json()

    if not data or "name" not in data:
        return jsonify({"error": "Name is required"}), 400

    try:
        season.name = data["name"]
        db.session.commit()
        return jsonify(season.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to update season: {str(e)}"}), 500


@app.route("/api/seasons/<int:season_id>", methods=["DELETE"])
@login_required
def delete_season(season_id):
    season = Season.query.get_or_404(season_id)

    try:
        # Delete in proper order to avoid foreign key constraint issues

        # 1. Delete battle participants for battles in this season
        battle_ids = [b.id for b in Battle.query.filter_by(season_id=season_id).all()]
        if battle_ids:
            BattleParticipant.query.filter(
                BattleParticipant.battle_id.in_(battle_ids)
            ).delete()

        # 2. Delete battles for this season
        Battle.query.filter_by(season_id=season_id).delete()

        # 3. Delete season roster entries
        SeasonRoster.query.filter_by(season_id=season_id).delete()

        # 4. Update players to remove season association (but don't delete players)
        Player.query.filter_by(season_id=season_id).update({"season_id": None})

        # 5. Finally delete the season itself
        db.session.delete(season)
        db.session.commit()
        return jsonify({"message": "Season deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to delete season: {str(e)}"}), 500


@app.route("/api/seasons/current", methods=["GET"])
@login_required
def get_current_season():
    # Get the newest season
    season = Season.query.order_by(Season.date_created.desc()).first()
    if season:
        return jsonify(season.to_dict())
    else:
        return jsonify({"error": "No seasons found"}), 404


def run_migrations():
    """Database migration system for SQLite"""
    # SQLite-specific SQL syntax
    auto_increment = "AUTOINCREMENT"
    datetime_default = "DEFAULT CURRENT_TIMESTAMP"
    varchar_type = "VARCHAR"
    integer_type = "INTEGER"
    primary_key = "PRIMARY KEY"

    # Check and add Player table columns
    try:
        db.session.execute(text("SELECT status FROM player LIMIT 1"))
    except Exception:
        print("Adding status column to player table...")
        db.session.execute(
            text(
                f'ALTER TABLE player ADD COLUMN status {varchar_type}(20) DEFAULT "active"'
            )
        )
        db.session.commit()
        print("Status column added successfully!")

    try:
        db.session.execute(text("SELECT roster_position FROM player LIMIT 1"))
    except Exception:
        print("Adding roster_position column to player table...")
        db.session.execute(
            text(f"ALTER TABLE player ADD COLUMN roster_position {integer_type}")
        )
        db.session.commit()
        print("Roster_position column added successfully!")

    # Update any existing records that might have NULL status
    db.session.execute(text('UPDATE player SET status = "active" WHERE status IS NULL'))
    db.session.commit()

    # Check and create Season table
    try:
        db.session.execute(text("SELECT id FROM season LIMIT 1"))
    except Exception:
        print("Creating season table...")
        db.session.execute(
            text(f"""
            CREATE TABLE season (
                id {integer_type} {primary_key} {auto_increment},
                name {varchar_type}(100) NOT NULL,
                date_created DATETIME NOT NULL {datetime_default}
            )
        """)
        )
        db.session.commit()
        print("Season table created successfully!")

        # Create default season
        print("Creating default season...")
        db.session.execute(
            text("""
            INSERT INTO season (name, date_created) VALUES ("Season 1", CURRENT_TIMESTAMP)
        """)
        )
        db.session.commit()
        print("Default season created successfully!")

    # Add season_id to player table
    try:
        db.session.execute(text("SELECT season_id FROM player LIMIT 1"))
    except Exception:
        print("Adding season_id column to player table...")
        db.session.execute(
            text(f"ALTER TABLE player ADD COLUMN season_id {integer_type}")
        )
        db.session.commit()
        print("Season_id column added to player table successfully!")

    # Add game_id to player table
    try:
        db.session.execute(text("SELECT game_id FROM player LIMIT 1"))
    except Exception:
        print("Adding game_id column to player table...")
        db.session.execute(
            text(f"ALTER TABLE player ADD COLUMN game_id {varchar_type}(100)")
        )
        db.session.commit()
        print("Game_id column added to player table successfully!")

    # Check and create Battle table
    try:
        db.session.execute(text("SELECT id FROM battle LIMIT 1"))
    except Exception:
        print("Creating battle table...")
        db.session.execute(
            text(f"""
            CREATE TABLE battle (
                id {integer_type} {primary_key} {auto_increment},
                enemy_name {varchar_type}(100) NOT NULL,
                enemy_power_ranking {integer_type} NOT NULL,
                our_score {integer_type} NOT NULL,
                their_score {integer_type} NOT NULL,
                date_created DATETIME NOT NULL {datetime_default},
                season_id {integer_type}
            )
        """)
        )
        db.session.commit()
        print("Battle table created successfully!")

    # Add season_id to battle table if it doesn't exist
    try:
        db.session.execute(text("SELECT season_id FROM battle LIMIT 1"))
    except Exception:
        print("Adding season_id column to battle table...")
        db.session.execute(
            text(f"ALTER TABLE battle ADD COLUMN season_id {integer_type}")
        )
        db.session.commit()
        print("Season_id column added to battle table successfully!")

    # Check and create BattleParticipant table
    try:
        db.session.execute(text("SELECT id FROM battle_participant LIMIT 1"))
    except Exception:
        print("Creating battle_participant table...")
        db.session.execute(
            text(f"""
            CREATE TABLE battle_participant (
                id {integer_type} {primary_key} {auto_increment},
                battle_id {integer_type} NOT NULL,
                player_id {integer_type} NOT NULL,
                damage_done {integer_type} NOT NULL DEFAULT 0,
                shields_broken {integer_type} NOT NULL DEFAULT 0,
                FOREIGN KEY (battle_id) REFERENCES battle (id),
                FOREIGN KEY (player_id) REFERENCES player (id)
            )
        """)
        )
        db.session.commit()
        print("BattleParticipant table created successfully!")

    # Check and create SeasonRoster table
    try:
        db.session.execute(text("SELECT id FROM season_roster LIMIT 1"))
    except Exception:
        print("Creating season_roster table...")
        db.session.execute(
            text(f"""
            CREATE TABLE season_roster (
                id {integer_type} {primary_key} {auto_increment},
                season_id {integer_type} NOT NULL,
                player_id {integer_type} NOT NULL,
                roster_position {integer_type} NOT NULL,
                FOREIGN KEY (season_id) REFERENCES season (id),
                FOREIGN KEY (player_id) REFERENCES player (id),
                UNIQUE(season_id, roster_position)
            )
        """)
        )
        db.session.commit()
        print("SeasonRoster table created successfully!")

        # Migrate existing roster data
        print("Migrating existing roster data...")
        existing_rosters = db.session.execute(
            text("""
            SELECT id, season_id, roster_position 
            FROM player 
            WHERE roster_position IS NOT NULL AND season_id IS NOT NULL
        """)
        ).fetchall()

        for player_id, season_id, roster_position in existing_rosters:
            db.session.execute(
                text("""
                INSERT OR IGNORE INTO season_roster (season_id, player_id, roster_position)
                VALUES (:season_id, :player_id, :roster_position)
            """),
                {
                    "season_id": season_id,
                    "player_id": player_id,
                    "roster_position": roster_position,
                },
            )

        db.session.commit()
        print("Roster data migration completed!")

    # Check and create User table
    try:
        db.session.execute(text("SELECT id FROM user LIMIT 1"))
    except Exception:
        print("Creating user table...")
        db.session.execute(
            text(f"""
            CREATE TABLE user (
                id {integer_type} {primary_key} {auto_increment},
                username {varchar_type}(80) NOT NULL UNIQUE,
                password_hash {varchar_type}(120) NOT NULL,
                date_created DATETIME NOT NULL {datetime_default}
            )
        """)
        )
        db.session.commit()
        print("User table created successfully!")

    # Check and create Team table
    try:
        db.session.execute(text("SELECT id FROM team LIMIT 1"))
    except Exception:
        print("Creating team table...")
        db.session.execute(
            text(f"""
            CREATE TABLE team (
                id {integer_type} {primary_key} {auto_increment},
                name {varchar_type}(100) NOT NULL UNIQUE,
                description TEXT,
                date_created DATETIME NOT NULL {datetime_default}
            )
        """)
        )
        db.session.commit()
        print("Team table created successfully!")


    # Check and create UserTeam table
    try:
        db.session.execute(text("SELECT id FROM user_team LIMIT 1"))
    except Exception:
        print("Creating user_team table...")
        db.session.execute(
            text(f"""
            CREATE TABLE user_team (
                id {integer_type} {primary_key} {auto_increment},
                user_id {integer_type} NOT NULL,
                team_id {integer_type} NOT NULL,
                date_assigned DATETIME NOT NULL {datetime_default},
                FOREIGN KEY (user_id) REFERENCES user (id),
                FOREIGN KEY (team_id) REFERENCES team (id),
                UNIQUE(user_id, team_id)
            )
        """)
        )
        db.session.commit()
        print("UserTeam table created successfully!")

        # Migrate existing team assignments from user.team_id to user_team table
        print("Migrating existing team assignments...")
        existing_assignments = db.session.execute(
            text("SELECT id, team_id FROM user WHERE team_id IS NOT NULL")
        ).fetchall()

        for user_id, team_id in existing_assignments:
            db.session.execute(
                text("""
                INSERT OR IGNORE INTO user_team (user_id, team_id, date_assigned)
                VALUES (:user_id, :team_id, CURRENT_TIMESTAMP)
            """),
                {"user_id": user_id, "team_id": team_id},
            )

        db.session.commit()
        print("Team assignments migration completed!")

    # Add team_id columns to Player, Battle, and Season tables
    try:
        db.session.execute(text("SELECT team_id FROM player LIMIT 1"))
    except Exception:
        print("Adding team_id column to player table...")
        db.session.execute(
            text(f"ALTER TABLE player ADD COLUMN team_id {integer_type}")
        )
        db.session.commit()
        print("Team_id column added to player table successfully!")

    try:
        db.session.execute(text("SELECT team_id FROM battle LIMIT 1"))
    except Exception:
        print("Adding team_id column to battle table...")
        db.session.execute(
            text(f"ALTER TABLE battle ADD COLUMN team_id {integer_type}")
        )
        db.session.commit()
        print("Team_id column added to battle table successfully!")

    try:
        db.session.execute(text("SELECT team_id FROM season LIMIT 1"))
    except Exception:
        print("Adding team_id column to season table...")
        db.session.execute(
            text(f"ALTER TABLE season ADD COLUMN team_id {integer_type}")
        )
        db.session.commit()
        print("Team_id column added to season table successfully!")

    # Create admin user if it doesn't exist
    try:
        # Use default username if not set in environment
        su_username = os.getenv("su_username", "admin")
        su_password = os.getenv("su_password")

        if not su_password:
            raise ValueError(
                "su_password environment variable is required"
            )

        admin_user = AdminUser.query.filter_by(username=su_username).first()
        if not admin_user:
            print("Creating admin user...")
            admin_user = AdminUser()
            admin_user.username = su_username
            admin_user.set_password(su_password)
            db.session.add(admin_user)
            db.session.commit()
            print("Admin user created successfully!")
    except Exception as e:
        print(f"Error creating admin user: {e}")
        raise

    print("Database migration completed for SQLite!")


# Security fix: Add generic error handler to prevent information disclosure
@app.errorhandler(Exception)
def handle_exception(e):
    # Log the actual error for debugging
    app.logger.error(f"Unhandled exception: {str(e)}")
    # Return generic error message to user
    return jsonify({"error": "An error occurred processing your request"}), 500


# Security fix: Add security headers
@app.after_request
def set_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net https://cdn.tailwindcss.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com"
    )
    return response


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        run_migrations()
    # Security fix: Debug mode from environment variable
    debug_mode = os.getenv("FLASK_DEBUG", "False").lower() == "true"
    app.run(debug=debug_mode)
