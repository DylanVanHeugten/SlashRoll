from datetime import datetime, timezone

from flask import Flask, jsonify, render_template, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///slashroll.db"

CORS(app)
db = SQLAlchemy(app)


class Season(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    date_created = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "date_created": self.date_created.isoformat(),
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

    season = db.relationship("Season", backref="players")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "game_id": self.game_id,
            "status": self.status,
            "roster_position": self.roster_position,
            "season_id": self.season_id,
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
    date_created = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    season_id = db.Column(db.Integer, db.ForeignKey("season.id"), nullable=True)
    # team_id = db.Column(db.Integer, db.ForeignKey("team.id"), nullable=True)

    season = db.relationship("Season", backref="battles")

    def to_dict(self):
        try:
            total_damage = sum(p.damage_done for p in self.participants)
        except:
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
    return render_template("index.html")


@app.route("/api/players", methods=["GET"])
def get_players():
    status = request.args.get("status", "active")
    season_id = request.args.get("season_id")

    query = Player.query
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

            # Get season names
            if season_ids:
                seasons = Season.query.filter(Season.id.in_(season_ids)).all()
                player_data["seasons"] = [{"id": s.id, "name": s.name} for s in seasons]
            else:
                player_data["seasons"] = []

            players_data.append(player_data)
        return jsonify(players_data)
    else:
        players = query.filter_by(status=status).all()
        return jsonify([player.to_dict() for player in players])


@app.route("/api/players/roster", methods=["GET"])
def get_roster():
    season_id = request.args.get("season_id")

    if season_id:
        # Use new SeasonRoster table
        season_rosters = (
            SeasonRoster.query.filter_by(season_id=season_id)
            .join(Player)
            .filter(Player.status == "active")
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
        # Fallback to old method for backward compatibility
        query = Player.query.filter_by(status="active").filter(
            Player.roster_position.isnot(None)
        )
        players = query.order_by(Player.roster_position).all()
        return jsonify([player.to_dict() for player in players])


@app.route("/api/players/<int:player_id>/status", methods=["PUT"])
def update_player_status(player_id):
    player = Player.query.get_or_404(player_id)
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
def update_roster_position(player_id):
    player = Player.query.get_or_404(player_id)
    data = request.get_json()

    if player.status != "active":
        return jsonify({"error": "Only active players can be added to roster"}), 400

    position = data.get("position")
    season_id = data.get("season_id")

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
            # Fallback to old method
            existing_player = Player.query.filter_by(roster_position=position).first()
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
def add_player():
    data = request.get_json()

    if not data or "name" not in data:
        return jsonify({"error": "Name is required"}), 400

    # Check if GameID is already in use
    if data.get("game_id") and data.get("game_id").strip():
        existing_player = Player.query.filter_by(
            game_id=data.get("game_id").strip()
        ).first()
        if existing_player:
            return jsonify(
                {"error": f"Game ID is already used by player: {existing_player.name}"}
            ), 400

    player = Player(
        name=data["name"],
        game_id=data.get("game_id").strip() if data.get("game_id") else None,
        season_id=data.get("season_id"),
    )

    try:
        db.session.add(player)
        db.session.commit()
        return jsonify(player.to_dict()), 201
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to add player"}), 500


@app.route("/api/players/<int:player_id>", methods=["PUT"])
def update_player(player_id):
    player = Player.query.get_or_404(player_id)
    data = request.get_json()

    if "season_id" in data:
        player.season_id = data["season_id"]

    if "game_id" in data:
        new_game_id = data["game_id"].strip() if data["game_id"] else None
        # Check if GameID is already in use by another player
        if new_game_id:
            existing_player = (
                Player.query.filter_by(game_id=new_game_id)
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
def delete_player(player_id):
    player = Player.query.get_or_404(player_id)

    try:
        db.session.delete(player)
        db.session.commit()
        return jsonify({"message": "Player deleted successfully"}), 200
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to delete player"}), 500


# Battle endpoints
@app.route("/api/battles", methods=["GET"])
def get_battles():
    season_id = request.args.get("season_id")

    query = Battle.query
    if season_id:
        query = query.filter_by(season_id=season_id)

    battles = query.order_by(Battle.date_created.desc()).all()
    return jsonify([battle.to_dict() for battle in battles])


@app.route("/api/battles", methods=["POST"])
def create_battle():
    data = request.get_json()

    required_fields = [
        "enemy_name",
        "enemy_power_ranking",
        "our_score",
        "their_score",
        "participants",
    ]
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"{field} is required"}), 400

    battle = Battle(
        enemy_name=data["enemy_name"],
        enemy_power_ranking=data["enemy_power_ranking"],
        our_score=data["our_score"],
        their_score=data["their_score"],
        season_id=data.get("season_id"),
    )

    try:
        db.session.add(battle)
        db.session.flush()  # Get the battle ID

        # Add battle participants
        for participant_data in data["participants"]:
            if "player_id" not in participant_data:
                continue

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
def get_battle(battle_id):
    battle = Battle.query.get_or_404(battle_id)
    battle_data = battle.to_dict()
    battle_data["participants"] = [p.to_dict() for p in battle.participants]
    return jsonify(battle_data)


@app.route("/api/battles/<int:battle_id>", methods=["PUT"])
def update_battle(battle_id):
    battle = Battle.query.get_or_404(battle_id)
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

            # Add updated participants
            for participant_data in data["participants"]:
                if "player_id" not in participant_data:
                    continue

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
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to update battle"}), 500


@app.route("/api/battles/<int:battle_id>", methods=["DELETE"])
def delete_battle(battle_id):
    battle = Battle.query.get_or_404(battle_id)

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
def get_player_battle_stats(player_id):
    player = Player.query.get_or_404(player_id)
    season_id = request.args.get("season_id")

    # Base query for battle participants
    query = db.session.query(BattleParticipant).filter_by(player_id=player_id)

    # Filter by season if specified
    if season_id:
        query = query.join(Battle).filter(Battle.season_id == season_id)

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
def get_seasons():
    seasons = Season.query.order_by(Season.date_created.desc()).all()
    return jsonify([season.to_dict() for season in seasons])


@app.route("/api/seasons", methods=["POST"])
def create_season():
    data = request.get_json()

    if not data or "name" not in data:
        return jsonify({"error": "Name is required"}), 400

    season = Season(name=data["name"])

    try:
        db.session.add(season)
        db.session.commit()
        return jsonify(season.to_dict()), 201
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to create season"}), 500


@app.route("/api/seasons/<int:season_id>", methods=["PUT"])
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

    print("Database migration completed for SQLite!")


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        run_migrations()
    app.run(debug=True)
