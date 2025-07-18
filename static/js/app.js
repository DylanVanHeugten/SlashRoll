const { useState, useEffect } = React;


// Utility function to format damage numbers with abbreviations
function formatDamage(number) {
  if (number < 1000) {
    return number.toString();
  } else if (number < 1000000) {
    // For numbers 1000-9999: only abbreviate if it's an exact thousand or >= 10000
    if (number >= 1000 && number < 10000) {
      // Only abbreviate exact thousands (1000, 2000, 3000, etc.)
      if (number % 1000 === 0) {
        return number / 1000 + "k";
      }
      // Show full number for non-exact thousands
      return number.toString();
    }

    // For numbers >= 10000: always abbreviate
    const value = number / 1000;
    const formatted = value.toFixed(2).replace(".", ",");
    // Remove trailing zeros after comma
    return formatted.replace(/,?0+$/, "") + "k";
  } else {
    const value = number / 1000000;
    const formatted = value.toFixed(2).replace(".", ",");
    // Remove trailing zeros after comma
    return formatted.replace(/,?0+$/, "") + "M";
  }
}

function Modal({ isOpen, onClose, title, message, type = "info" }) {
  if (!isOpen) return null;

  const getModalIcon = () => {
    switch (type) {
      case "error":
        return "⚠️";
      case "success":
        return "✅";
      case "warning":
        return "⚠️";
      default:
        return "ℹ️";
    }
  };

  const getModalClass = () => {
    switch (type) {
      case "error":
        return "modal-error";
      case "success":
        return "modal-success";
      case "warning":
        return "modal-warning";
      default:
        return "modal-info";
    }
  };

  return React.createElement(
    "div",
    { className: "modal-overlay", onClick: onClose },
    React.createElement(
      "div",
      { className: `modal-content ${getModalClass()}`, onClick: (e) => e.stopPropagation() },
      React.createElement(
        "div",
        { className: "modal-header" },
        React.createElement("span", { className: "modal-icon" }, getModalIcon()),
        React.createElement("h3", { className: "modal-title" }, title || "Notification"),
        React.createElement("button", { className: "modal-close", onClick: onClose }, "×")
      ),
      React.createElement("div", { className: "modal-body" }, message),
      React.createElement(
        "div",
        { className: "modal-footer" },
        React.createElement("button", { className: "modal-btn", onClick: onClose }, "OK")
      )
    )
  );
}

function SeasonSelector({
  seasons,
  currentSeason,
  onSeasonChange,
  onCreateSeason,
  showCreateButton = false,
  currentTeam,
  showModal,
}) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSeasonName, setNewSeasonName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreateSeason = async (e) => {
    e.preventDefault();
    if (!newSeasonName.trim()) return;

    setCreating(true);
    try {
      const response = await fetch("/api/seasons", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          name: newSeasonName.trim(),
          team_id: currentTeam?.id
        }),
      });

      if (response.ok) {
        const newSeason = await response.json();
        onCreateSeason(newSeason);
        setNewSeasonName("");
        setShowCreateForm(false);
      } else {
        showModal("Failed to create season", "Error", "error");
      }
    } catch (error) {
      showModal("Network error occurred", "Error", "error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="season-selector">
      <div className="season-controls">
        <label htmlFor="season-select">Season:</label>
        <select
          id="season-select"
          value={currentSeason?.id || ""}
          onChange={(e) => {
            const selectedSeason = seasons.find(
              (s) => s.id === parseInt(e.target.value)
            );
            onSeasonChange(selectedSeason);
          }}
        >
          <option value="">Select Season</option>
          {seasons.map((season) => (
            <option key={season.id} value={season.id}>
              {season.name}
            </option>
          ))}
        </select>
        {showCreateButton && (
          <button
            className="create-season-btn"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? "Cancel" : "New Season"}
          </button>
        )}
      </div>

      {showCreateButton && showCreateForm && (
        <form onSubmit={handleCreateSeason} className="create-season-form">
          <input
            type="text"
            value={newSeasonName}
            onChange={(e) => setNewSeasonName(e.target.value)}
            placeholder="Enter season name"
            disabled={creating}
          />
          <button type="submit" disabled={creating || !newSeasonName.trim()}>
            {creating ? "Creating..." : "Create"}
          </button>
        </form>
      )}
    </div>
  );
}

function TeamSelector({
  teams,
  currentTeam,
  onTeamChange,
  onCreateTeam,
  showCreateButton = false,
  showModal,
}) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDescription, setNewTeamDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    setCreating(true);
    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          name: newTeamName.trim(),
          description: newTeamDescription.trim() || null
        }),
      });

      if (response.ok) {
        const newTeam = await response.json();
        onCreateTeam(newTeam);
        setNewTeamName("");
        setNewTeamDescription("");
        setShowCreateForm(false);
      } else {
        const error = await response.json();
        showModal(`Failed to create team: ${error.error}`, "Error", "error");
      }
    } catch (error) {
      console.error("Error creating team:", error);
      showModal("Error creating team", "Error", "error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="team-selector">
      <label htmlFor="team-select">Team:</label>
      <select
        id="team-select"
        value={currentTeam?.id || ""}
        onChange={(e) => {
          const selectedTeam = teams.find(
            (team) => team.id === parseInt(e.target.value)
          );
          onTeamChange(selectedTeam);
        }}
      >
        <option value="">Select a team</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
      
      {showCreateButton && (
        <button
          className="create-team-btn"
          onClick={() => setShowCreateForm(true)}
        >
          Create Team
        </button>
      )}

      {showCreateForm && (
        <div className="create-team-form">
          <form onSubmit={handleCreateTeam}>
            <input
              type="text"
              placeholder="Team name"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              required
              disabled={creating}
            />
            <input
              type="text"
              placeholder="Team description (optional)"
              value={newTeamDescription}
              onChange={(e) => setNewTeamDescription(e.target.value)}
              disabled={creating}
            />
            <div className="form-actions">
              <button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewTeamName("");
                  setNewTeamDescription("");
                }}
                disabled={creating}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Navigation({ currentPage, onPageChange, user }) {
  return (
    <nav className="navigation">
      {user?.is_superadmin ? (
        // Superuser only sees Super Admin panel
        <button
          className={currentPage === "super-admin" ? "active" : ""}
          onClick={() => onPageChange("super-admin")}
        >
          Super Admin
        </button>
      ) : (
        // Regular users see all other panels
        <>
          <button
            className={currentPage === "players" ? "active" : ""}
            onClick={() => onPageChange("players")}
          >
            Players
          </button>
          <button
            className={currentPage === "battles" ? "active" : ""}
            onClick={() => onPageChange("battles")}
          >
            Battles
          </button>
          <button
            className={currentPage === "manage" ? "active" : ""}
            onClick={() => onPageChange("manage")}
          >
            Administrator Dashboard
          </button>
        </>
      )}
    </nav>
  );
}

function ActiveRoster({
  roster,
  onRemoveFromRoster,
  onMovePlayer,
  onSwapPlayers,
  playerStats,
  seasons,
  currentSeason,
  onSeasonChange,
  onCreateSeason,
  currentTeam,
}) {
  const [draggedPlayer, setDraggedPlayer] = useState(null);
  const [dragOverSlot, setDragOverSlot] = useState(null);

  const handleDragStart = (e, player) => {
    setDraggedPlayer(player);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDragEnter = (e, position) => {
    e.preventDefault();
    setDragOverSlot(position);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOverSlot(null);
  };

  const handleDrop = (e, targetPosition) => {
    e.preventDefault();
    if (draggedPlayer && draggedPlayer.roster_position !== targetPosition) {
      // Check if there's a player at the target position
      const targetPlayer = roster.find(
        (p) => p.roster_position === targetPosition
      );

      if (targetPlayer) {
        // Swap the two players
        onSwapPlayers(draggedPlayer.id, targetPlayer.id);
      } else {
        // Move to empty slot
        onMovePlayer(draggedPlayer.id, targetPosition);
      }
    }
    setDraggedPlayer(null);
    setDragOverSlot(null);
  };

  const rosterSlots = Array.from({ length: 20 }, (_, i) => {
    const position = i + 1;
    const player = roster.find((p) => p.roster_position === position);
    return { position, player };
  });

  return (
    <div className="active-roster">
      <h2>Active Roster ({roster.length}/20)</h2>
      <SeasonSelector
        seasons={seasons}
        currentSeason={currentSeason}
        onSeasonChange={onSeasonChange}
        onCreateSeason={onCreateSeason}
        currentTeam={currentTeam}
      />
      {currentSeason ? (
        <div className="roster-grid">
          {rosterSlots.map(({ position, player }) => (
            <div
              key={position}
              className={`roster-slot ${player ? "filled" : "empty"} ${
                dragOverSlot === position ? "drag-over" : ""
              } ${
                draggedPlayer && draggedPlayer.roster_position === position
                  ? "being-dragged"
                  : ""
              }`}
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnter(e, position)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, position)}
            >
              <div className="slot-number">{position}</div>
              {player ? (
                <div
                  className="roster-player"
                  draggable
                  onDragStart={(e) => handleDragStart(e, player)}
                >
                  <div className="player-name">{player.name}</div>
                  {playerStats[player.id] && (
                    <div className="player-battle-stats">
                      <div className="stat">
                        DMG: {formatDamage(playerStats[player.id].total_damage)}
                      </div>
                      <div className="stat">
                        Shields:{" "}
                        {formatDamage(
                          playerStats[player.id].total_shields_broken
                        )}
                      </div>
                      <div className="stat">
                        Battles: {playerStats[player.id].battles_participated}
                      </div>
                    </div>
                  )}
                  <button
                    className="remove-btn"
                    onClick={() => onRemoveFromRoster(player.id)}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="empty-slot">Empty</div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p>Please select a season to view the active roster.</p>
      )}
    </div>
  );
}

function PlayerForm({ onPlayerAdded, currentSeason, currentTeam }) {
  const [name, setName] = useState("");
  const [gameId, setGameId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/players", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          game_id: gameId.trim() || null,
          season_id: currentSeason?.id,
          team_id: currentTeam?.id,
        }),
      });

      if (response.ok) {
        const newPlayer = await response.json();
        onPlayerAdded(newPlayer);
        setName("");
        setGameId("");
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to add player");
      }
    } catch (error) {
      setError("Network error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-section">
      <h2>Add New Player</h2>
      {error && <div className="error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Name *</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            placeholder="Enter player name"
          />
        </div>
        <div className="form-group">
          <label htmlFor="gameId">Game ID</label>
          <input
            type="text"
            id="gameId"
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            disabled={loading}
            placeholder="Enter game ID (optional)"
            maxLength={8}
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? "Adding..." : "Add Player"}
        </button>
      </form>
    </div>
  );
}

function PlayerList({ players, onPlayerDeleted, onAddToRoster, roster, showModal }) {
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (playerId) => {
    setDeletingId(playerId);

    try {
      const response = await fetch(`/api/players/${playerId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        onPlayerDeleted(playerId);
      } else {
        showModal("Failed to delete player", "Error", "error");
      }
    } catch (error) {
      showModal("Network error occurred", "Error", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddToRoster = (playerId) => {
    if (roster.length >= 20) {
      showModal("Roster is full (20 players maximum)", "Warning", "warning");
      return;
    }

    // Find the first empty position between 1 and 20
    const occupiedPositions = roster
      .map((p) => p.roster_position)
      .filter((pos) => pos != null);
    let nextPosition = 1;

    for (let i = 1; i <= 20; i++) {
      if (!occupiedPositions.includes(i)) {
        nextPosition = i;
        break;
      }
    }

    onAddToRoster(playerId, nextPosition);
  };

  const isInRoster = (playerId) => {
    return roster.some((p) => p.id === playerId);
  };

  // Filter out players that are already in the current season's roster
  const availablePlayers = players.filter((player) => !isInRoster(player.id));

  return (
    <div className="players-list">
      <h2>Available Players ({availablePlayers.length})</h2>
      {availablePlayers.length === 0 ? (
        <p>
          No available players. All active players are already in the roster.
        </p>
      ) : (
        availablePlayers.map((player) => (
          <div key={player.id} className="player-item">
            <div className="player-info">
              <div className="player-name">
                {player.name}
                {player.game_id && (
                  <span className="game-id"> #{player.game_id}</span>
                )}
              </div>
            </div>
            <div className="player-actions">
              <button
                className="add-roster-btn"
                onClick={() => handleAddToRoster(player.id)}
                disabled={roster.length >= 20}
              >
                Add to Roster
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function BattleForm({ roster, onBattleAdded, currentSeason, currentTeam }) {
  const [enemyName, setEnemyName] = useState("");
  const [enemyPowerRanking, setEnemyPowerRanking] = useState("");
  const [ourScore, setOurScore] = useState("");
  const [theirScore, setTheirScore] = useState("");
  const [participantStats, setParticipantStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleParticipantChange = (playerId, field, value) => {
    setParticipantStats((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [field]:
          field === "damage_done"
            ? Math.max(1, parseInt(value) || 1)
            : parseInt(value) || 0,
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!enemyName.trim() || !enemyPowerRanking || !ourScore || !theirScore) {
      setError("All battle fields are required");
      return;
    }

    setLoading(true);
    setError("");

    const participants = roster.map((player) => ({
      player_id: player.id,
      damage_done: participantStats[player.id]?.damage_done || 1,
      shields_broken: participantStats[player.id]?.shields_broken || 0,
    }));

    try {
      const response = await fetch("/api/battles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enemy_name: enemyName.trim(),
          enemy_power_ranking: parseInt(enemyPowerRanking),
          our_score: parseInt(ourScore),
          their_score: parseInt(theirScore),
          season_id: currentSeason?.id,
          team_id: currentTeam?.id,
          participants: participants,
        }),
      });

      if (response.ok) {
        const newBattle = await response.json();
        onBattleAdded(newBattle);
        setEnemyName("");
        setEnemyPowerRanking("");
        setOurScore("");
        setTheirScore("");
        setParticipantStats({});
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to create battle");
      }
    } catch (error) {
      setError("Network error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-section">
      <h2>Record New Battle</h2>
      {error && <div className="error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="battle-info">
          <div className="form-group">
            <label htmlFor="enemyName">Enemy Name *</label>
            <input
              type="text"
              id="enemyName"
              value={enemyName}
              onChange={(e) => setEnemyName(e.target.value)}
              disabled={loading}
              placeholder="Enter enemy name"
            />
          </div>
          <div className="form-group">
            <label htmlFor="enemyPowerRanking">Enemy Power Ranking *</label>
            <input
              type="number"
              id="enemyPowerRanking"
              value={enemyPowerRanking}
              onChange={(e) => setEnemyPowerRanking(e.target.value)}
              disabled={loading}
              placeholder="Enter power ranking"
            />
          </div>
          <div className="form-group">
            <label htmlFor="ourScore">Our Score *</label>
            <input
              type="number"
              id="ourScore"
              value={ourScore}
              onChange={(e) => setOurScore(e.target.value)}
              disabled={loading}
              placeholder="Our score"
            />
          </div>
          <div className="form-group">
            <label htmlFor="theirScore">Their Score *</label>
            <input
              type="number"
              id="theirScore"
              value={theirScore}
              onChange={(e) => setTheirScore(e.target.value)}
              disabled={loading}
              placeholder="Their score"
            />
          </div>
        </div>

        <div className="participant-stats">
          <h3>Player Performance</h3>
          {roster.length === 0 ? (
            <p>No players in active roster</p>
          ) : (
            <div className="stats-grid">
              {roster.map((player) => (
                <div key={player.id} className="player-stats">
                  <h4>{player.name}</h4>
                  <div className="stat-inputs">
                    <div className="form-group">
                      <label>Damage Done *</label>
                      <input
                        type="number"
                        min="1"
                        value={participantStats[player.id]?.damage_done || ""}
                        onChange={(e) =>
                          handleParticipantChange(
                            player.id,
                            "damage_done",
                            e.target.value
                          )
                        }
                        disabled={loading}
                        placeholder="1"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Shields Broken</label>
                      <input
                        type="number"
                        min="0"
                        value={participantStats[player.id]?.shields_broken || 0}
                        onChange={(e) =>
                          handleParticipantChange(
                            player.id,
                            "shields_broken",
                            e.target.value
                          )
                        }
                        disabled={loading}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="submit" disabled={loading || roster.length === 0}>
          {loading ? "Recording..." : "Record Battle"}
        </button>
      </form>
    </div>
  );
}

function BattleEdit({ battle, onBattleUpdated, onCancel, currentSeason }) {
  const [enemyName, setEnemyName] = useState(battle.enemy_name);
  const [enemyPowerRanking, setEnemyPowerRanking] = useState(
    battle.enemy_power_ranking
  );
  const [ourScore, setOurScore] = useState(battle.our_score);
  const [theirScore, setTheirScore] = useState(battle.their_score);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Fetch battle details with participants
    const fetchBattleDetails = async () => {
      try {
        const response = await fetch(`/api/battles/${battle.id}`);
        if (response.ok) {
          const data = await response.json();
          setParticipants(data.participants || []);
        }
      } catch (error) {
        setError("Failed to load battle details");
      }
    };

    fetchBattleDetails();
  }, [battle.id]);

  const handleParticipantChange = (participantId, field, value) => {
    setParticipants((prev) =>
      prev.map((p) =>
        p.id === participantId
          ? {
              ...p,
              [field]:
                field === "damage_done"
                  ? Math.max(1, parseInt(value) || 1)
                  : parseInt(value) || 0,
            }
          : p
      )
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/battles/${battle.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enemy_name: enemyName.trim(),
          enemy_power_ranking: parseInt(enemyPowerRanking),
          our_score: parseInt(ourScore),
          their_score: parseInt(theirScore),
          participants: participants.map((p) => ({
            player_id: p.player_id,
            damage_done: p.damage_done,
            shields_broken: p.shields_broken,
          })),
        }),
      });

      if (response.ok) {
        const updatedBattle = await response.json();
        onBattleUpdated(updatedBattle);
        onCancel();
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to update battle");
      }
    } catch (error) {
      setError("Network error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-section">
      <h3>Edit Battle</h3>
      {error && <div className="error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="battle-info">
          <div className="form-group">
            <label htmlFor="enemyName">Enemy Name *</label>
            <input
              type="text"
              id="enemyName"
              value={enemyName}
              onChange={(e) => setEnemyName(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="enemyPowerRanking">Enemy Power Ranking *</label>
            <input
              type="number"
              id="enemyPowerRanking"
              value={enemyPowerRanking}
              onChange={(e) => setEnemyPowerRanking(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="ourScore">Our Score *</label>
            <input
              type="number"
              id="ourScore"
              value={ourScore}
              onChange={(e) => setOurScore(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="theirScore">Their Score *</label>
            <input
              type="number"
              id="theirScore"
              value={theirScore}
              onChange={(e) => setTheirScore(e.target.value)}
              disabled={loading}
              required
            />
          </div>
        </div>

        <div className="participant-stats">
          <h4>Player Performance</h4>
          {participants.length === 0 ? (
            <p>Loading participants...</p>
          ) : (
            <div className="stats-grid">
              {participants.map((participant) => (
                <div key={participant.id} className="player-stats">
                  <h5>{participant.player_name}</h5>
                  <div className="stat-inputs">
                    <div className="form-group">
                      <label>Damage Done *</label>
                      <input
                        type="number"
                        min="1"
                        value={participant.damage_done}
                        onChange={(e) =>
                          handleParticipantChange(
                            participant.id,
                            "damage_done",
                            e.target.value
                          )
                        }
                        disabled={loading}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Shields Broken</label>
                      <input
                        type="number"
                        min="0"
                        value={participant.shields_broken}
                        onChange={(e) =>
                          handleParticipantChange(
                            participant.id,
                            "shields_broken",
                            e.target.value
                          )
                        }
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button type="submit" disabled={loading}>
            {loading ? "Updating..." : "Update Battle"}
          </button>
          <button type="button" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function BattleList({ battles, onBattleDeleted, onBattleUpdated, currentSeason, showModal }) {
  const [deletingId, setDeletingId] = useState(null);
  const [editingBattle, setEditingBattle] = useState(null);

  const handleDelete = async (battleId) => {
    // TODO: Convert to modal confirmation
    if (!confirm("Are you sure you want to delete this battle?")) return;

    setDeletingId(battleId);

    try {
      const response = await fetch(`/api/battles/${battleId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        onBattleDeleted(battleId);
      } else {
        showModal("Failed to delete battle", "Error", "error");
      }
    } catch (error) {
      showModal("Network error occurred", "Error", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (battle) => {
    setEditingBattle(battle);
  };

  const handleCancelEdit = () => {
    setEditingBattle(null);
  };

  const handleBattleUpdated = (updatedBattle) => {
    onBattleUpdated(updatedBattle);
    setEditingBattle(null);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (editingBattle) {
    return (
      <BattleEdit
        battle={editingBattle}
        onBattleUpdated={handleBattleUpdated}
        onCancel={handleCancelEdit}
        currentSeason={currentSeason}
      />
    );
  }

  return (
    <div className="battles-list">
      <h2>Battle History ({battles.length})</h2>
      {battles.length === 0 ? (
        <p>No battles recorded yet.</p>
      ) : (
        <div className="battles-table">
          <div className="table-header">
            <div>Date</div>
            <div>Enemy</div>
            <div>Power Ranking</div>
            <div>Score</div>
            <div>Total Damage</div>
            <div>Result</div>
            <div>Actions</div>
          </div>
          {battles.map((battle) => (
            <div key={battle.id} className="table-row">
              <div>{formatDate(battle.date_created)}</div>
              <div>{battle.enemy_name}</div>
              <div>{battle.enemy_power_ranking}</div>
              <div>
                {battle.our_score} - {battle.their_score}
              </div>
              <div className="total-damage">
                {formatDamage(battle.total_damage || 0)}
              </div>
              <div
                className={`battle-result ${
                  battle.our_score > battle.their_score
                    ? "win"
                    : battle.our_score < battle.their_score
                    ? "loss"
                    : "tie"
                }`}
              >
                {battle.our_score > battle.their_score
                  ? "Win"
                  : battle.our_score < battle.their_score
                  ? "Loss"
                  : "Tie"}
              </div>
              <div>
                <button
                  className="edit-btn"
                  onClick={() => handleEdit(battle)}
                  style={{ marginRight: "5px" }}
                >
                  Edit
                </button>
                <button
                  className="delete-btn"
                  onClick={() => handleDelete(battle.id)}
                  disabled={deletingId === battle.id}
                >
                  {deletingId === battle.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminDashboard({
  players,
  onPlayerStatusChanged,
  onPlayerDeleted,
  onPlayerAdded,
  seasons,
  onSeasonDeleted,
  onSeasonUpdated,
  currentSeason,
  onSeasonChange,
  onCreateSeason,
  battles,
  onBattleUpdated,
  currentTeam,
}) {
  const [updatingId, setUpdatingId] = useState(null);
  const [editingGameId, setEditingGameId] = useState(null);
  const [gameIdValues, setGameIdValues] = useState({});
  const [error, setError] = useState("");
  const [deletingSeasonId, setDeletingSeasonId] = useState(null);
  const [editingSeasonId, setEditingSeasonId] = useState(null);
  const [seasonNameValues, setSeasonNameValues] = useState({});
  const [updatingSeasonId, setUpdatingSeasonId] = useState(null);

  const handleStatusChange = async (playerId, newStatus) => {
    setUpdatingId(playerId);
    setError("");

    try {
      const response = await fetch(`/api/players/${playerId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        const updatedPlayer = await response.json();
        onPlayerStatusChanged(updatedPlayer);
      } else {
        setError("Failed to update player status");
      }
    } catch (error) {
      setError("Network error occurred");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleGameIdEdit = (playerId, currentGameId) => {
    setEditingGameId(playerId);
    setError("");
    setGameIdValues((prev) => ({
      ...prev,
      [playerId]: currentGameId || "",
    }));
  };

  const handleGameIdSave = async (playerId) => {
    setUpdatingId(playerId);
    setError("");

    try {
      const response = await fetch(`/api/players/${playerId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          game_id: gameIdValues[playerId]?.trim() || null,
        }),
      });

      if (response.ok) {
        const updatedPlayer = await response.json();
        onPlayerStatusChanged(updatedPlayer);
        setEditingGameId(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to update game ID");
      }
    } catch (error) {
      setError("Network error occurred");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleGameIdCancel = () => {
    setEditingGameId(null);
    setGameIdValues({});
    setError("");
  };

  const handleSeasonRename = (seasonId, currentName) => {
    setEditingSeasonId(seasonId);
    setError("");
    setSeasonNameValues((prev) => ({
      ...prev,
      [seasonId]: currentName,
    }));
  };

  const handleSeasonNameSave = async (seasonId) => {
    const newName = seasonNameValues[seasonId]?.trim();
    if (!newName) {
      setError("Season name cannot be empty");
      return;
    }

    setUpdatingSeasonId(seasonId);
    setError("");

    try {
      const response = await fetch(`/api/seasons/${seasonId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newName }),
      });

      if (response.ok) {
        const updatedSeason = await response.json();
        onSeasonUpdated(updatedSeason);
        setEditingSeasonId(null);
        setSeasonNameValues({});
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to update season name");
      }
    } catch (error) {
      setError("Network error occurred");
    } finally {
      setUpdatingSeasonId(null);
    }
  };

  const handleSeasonNameCancel = () => {
    setEditingSeasonId(null);
    setSeasonNameValues({});
    setError("");
  };

  const handleSeasonDelete = async (seasonId) => {
    if (
      !confirm(
        "Are you sure you want to delete this season? This will delete all associated players and battles."
      )
    )
      return;

    setDeletingSeasonId(seasonId);
    setError("");

    try {
      const response = await fetch(`/api/seasons/${seasonId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        onSeasonDeleted(seasonId);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to delete season");
      }
    } catch (error) {
      setError("Network error occurred");
    } finally {
      setDeletingSeasonId(null);
    }
  };

  const handleDelete = async (playerId) => {
    if (!confirm("Are you sure you want to delete this player?")) return;

    setUpdatingId(playerId);
    setError("");

    try {
      const response = await fetch(`/api/players/${playerId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        onPlayerDeleted(playerId);
      } else {
        setError("Failed to delete player");
      }
    } catch (error) {
      setError("Network error occurred");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="admin-dashboard">
      <h2>Administrator Dashboard</h2>
      {error && <div className="error">{error}</div>}

      <div className="dashboard-sections">
        <div className="dashboard-row">
          <div className="dashboard-section">
            <h3>Add New Player</h3>
            <PlayerForm
              onPlayerAdded={onPlayerAdded}
              currentSeason={currentSeason}
              currentTeam={currentTeam}
            />
          </div>

          <div className="dashboard-section">
            <h3>Season Selection</h3>
            <SeasonSelector
              seasons={seasons}
              currentSeason={currentSeason}
              onSeasonChange={onSeasonChange}
              onCreateSeason={onCreateSeason}
              showCreateButton={true}
              currentTeam={currentTeam}
            />
          </div>
        </div>
        <div className="dashboard-section">
          <h3>Season Management</h3>
          <div className="seasons-admin">
            {seasons.length === 0 ? (
              <p>No seasons created yet.</p>
            ) : (
              <div className="seasons-table">
                <div className="table-header">
                  <div>Season Name</div>
                  <div>Created</div>
                  <div>Actions</div>
                </div>
                {seasons.map((season) => (
                  <div key={season.id} className="table-row">
                    <div className="season-name">
                      {editingSeasonId === season.id ? (
                        <div className="season-name-edit">
                          <input
                            type="text"
                            value={seasonNameValues[season.id] || ""}
                            onChange={(e) =>
                              setSeasonNameValues((prev) => ({
                                ...prev,
                                [season.id]: e.target.value,
                              }))
                            }
                            className="season-name-input"
                            placeholder="Enter season name"
                          />
                          <div className="season-name-actions">
                            <button
                              className="save-btn"
                              onClick={() => handleSeasonNameSave(season.id)}
                              disabled={updatingSeasonId === season.id}
                            >
                              {updatingSeasonId === season.id
                                ? "Saving..."
                                : "Save"}
                            </button>
                            <button
                              className="cancel-btn"
                              onClick={handleSeasonNameCancel}
                              disabled={updatingSeasonId === season.id}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        season.name
                      )}
                    </div>
                    <div className="season-date">
                      {new Date(season.date_created).toLocaleDateString()}
                    </div>
                    <div className="season-actions">
                      {editingSeasonId === season.id ? null : (
                        <>
                          <button
                            className="edit-btn"
                            onClick={() =>
                              handleSeasonRename(season.id, season.name)
                            }
                          >
                            Rename
                          </button>
                          <button
                            className="delete-btn"
                            onClick={() => handleSeasonDelete(season.id)}
                            disabled={deletingSeasonId === season.id}
                          >
                            {deletingSeasonId === season.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="dashboard-section">
          <h3>Battle Management</h3>
          <div className="battles-admin">
            {!currentSeason ? (
              <p>Please select a season to manage battles.</p>
            ) : battles.length === 0 ? (
              <p>No battles recorded for this season.</p>
            ) : (
              <BattleList
                battles={battles}
                onBattleDeleted={() => {}}
                onBattleUpdated={onBattleUpdated}
                currentSeason={currentSeason}
              />
            )}
          </div>
        </div>

        <div className="dashboard-section">
          <h3>Player Management</h3>
          <div className="players-admin">
            {players.length === 0 ? (
              <p>No players in database.</p>
            ) : (
              <div className="players-table">
                <div className="table-header">
                  <div>Name</div>
                  <div>Game ID</div>
                  <div>Season</div>
                  <div>Status</div>
                  <div>Actions</div>
                </div>
                {players.map((player) => (
                  <div key={player.id} className="table-row">
                    <div className="player-name">{player.name}</div>
                    <div className="player-game-id">
                      {editingGameId === player.id ? (
                        <div className="game-id-edit">
                          <input
                            type="text"
                            value={gameIdValues[player.id] || ""}
                            onChange={(e) =>
                              setGameIdValues((prev) => ({
                                ...prev,
                                [player.id]: e.target.value,
                              }))
                            }
                            disabled={updatingId === player.id}
                            placeholder="Enter game ID"
                            maxLength={8}
                          />
                          <button
                            onClick={() => handleGameIdSave(player.id)}
                            disabled={updatingId === player.id}
                            className="save-btn"
                          >
                            {updatingId === player.id ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={handleGameIdCancel}
                            disabled={updatingId === player.id}
                            className="cancel-btn"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="game-id-display">
                          <span>{player.game_id || "Not set"}</span>
                          <button
                            onClick={() =>
                              handleGameIdEdit(player.id, player.game_id)
                            }
                            disabled={updatingId === player.id}
                            className="edit-btn"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="player-season">
                      {player.seasons && player.seasons.length > 0 ? (
                        <div
                          className="seasons-display"
                          title={player.seasons.map((s) => s.name).join(", ")}
                        >
                          {player.seasons.length <= 2
                            ? player.seasons.map((s) => s.name).join(", ")
                            : `${player.seasons
                                .slice(0, 2)
                                .map((s) => s.name)
                                .join(", ")} (+${
                                player.seasons.length - 2
                              } more)`}
                        </div>
                      ) : (
                        <span className="no-seasons">No seasons</span>
                      )}
                    </div>
                    <div className={`player-status ${player.status}`}>
                      {player.status}
                    </div>
                    <div className="player-actions">
                      <button
                        className={`status-btn ${
                          player.status === "active" ? "deactivate" : "activate"
                        }`}
                        onClick={() =>
                          handleStatusChange(
                            player.id,
                            player.status === "active" ? "inactive" : "active"
                          )
                        }
                        disabled={updatingId === player.id}
                      >
                        {updatingId === player.id
                          ? "Updating..."
                          : player.status === "active"
                          ? "Deactivate"
                          : "Activate"}
                      </button>
                      <button
                        className="delete-btn"
                        onClick={() => handleDelete(player.id)}
                        disabled={updatingId === player.id}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


function SuperAdminPanel({ showModal }) {
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "" });
  const [creating, setCreating] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ username: "", password: "", team_ids: [] });
  const [updating, setUpdating] = useState(false);
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
  const [teamSearchTerm, setTeamSearchTerm] = useState("");
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  
  // Team management state
  const [showCreateTeamForm, setShowCreateTeamForm] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: "", description: "" });
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [editTeamForm, setEditTeamForm] = useState({ name: "", description: "" });
  const [updatingTeam, setUpdatingTeam] = useState(false);

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        setError("Failed to fetch users");
      }
    } catch (error) {
      setError("Network error occurred");
    }
  };

  const fetchTeams = async () => {
    try {
      const response = await fetch("/api/teams");
      if (response.ok) {
        const data = await response.json();
        setTeams(data);
      } else {
        setError("Failed to fetch teams");
      }
    } catch (error) {
      setError("Network error occurred");
    }
  };

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchUsers(), fetchTeams()]);
    setLoading(false);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.username.trim() || !newUser.password.trim()) {
      showModal("Username and password are required", "Error", "error");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newUser),
      });

      if (response.ok) {
        const createdUser = await response.json();
        setUsers([...users, createdUser]);
        setNewUser({ username: "", password: "" });
        setShowCreateForm(false);
        showModal("User created successfully", "Success", "success");
      } else {
        const errorData = await response.json();
        showModal(errorData.error || "Failed to create user", "Error", "error");
      }
    } catch (error) {
      showModal("Network error occurred", "Error", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setUsers(users.filter(user => user.id !== userId));
        showModal("User deleted successfully", "Success", "success");
      } else {
        showModal("Failed to delete user", "Error", "error");
      }
    } catch (error) {
      showModal("Network error occurred", "Error", "error");
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user.id);
    setEditForm({ 
      username: user.username, 
      password: "", 
      team_ids: user.teams ? user.teams.map(team => team.id) : [] 
    });
    setTeamSearchTerm(""); // Reset search term when starting to edit
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setEditForm({ username: "", password: "", team_ids: [] });
    setTeamDropdownOpen(false);
    setTeamSearchTerm("");
  };

  const handleTeamToggle = (teamId) => {
    if (editForm.team_ids.includes(teamId)) {
      setEditForm({...editForm, team_ids: editForm.team_ids.filter(id => id !== teamId)});
    } else {
      setEditForm({...editForm, team_ids: [...editForm.team_ids, teamId]});
    }
  };

  const handleDropdownToggle = (event) => {
    if (!teamDropdownOpen) {
      const rect = event.currentTarget.getBoundingClientRect();
      const dropdownWidth = 250;
      const viewportWidth = window.innerWidth;
      
      // Calculate left position, ensuring dropdown doesn't go off-screen
      let left = rect.left + window.scrollX;
      if (left + dropdownWidth > viewportWidth) {
        left = viewportWidth - dropdownWidth - 20; // 20px margin from edge
      }
      
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 2,
        left: Math.max(10, left) // Minimum 10px from left edge
      });
    }
    setTeamDropdownOpen(!teamDropdownOpen);
  };

  const filteredTeams = teams.filter(team => 
    team.name.toLowerCase().includes(teamSearchTerm.toLowerCase())
  );

  const getSelectedTeamNames = () => {
    return teams
      .filter(team => editForm.team_ids.includes(team.id))
      .map(team => team.name)
      .join(", ");
  };

  const handleUpdateUser = async (userId) => {
    if (!editForm.username.trim()) {
      showModal("Username cannot be empty", "Error", "error");
      return;
    }

    setUpdating(true);
    try {
      // Update user basic info first
      const updateData = { username: editForm.username.trim() };
      
      // Only include password if it's provided
      if (editForm.password.trim()) {
        updateData.password = editForm.password.trim();
      }

      const userResponse = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (!userResponse.ok) {
        const errorData = await userResponse.json();
        showModal(errorData.error || "Failed to update user", "Error", "error");
        return;
      }

      // Update team assignments
      const teamResponse = await fetch(`/api/users/${userId}/teams`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ team_ids: editForm.team_ids }),
      });

      if (teamResponse.ok) {
        const updatedUser = await teamResponse.json();
        setUsers(users.map(user => 
          user.id === userId ? updatedUser : user
        ));
        setEditingUser(null);
        setEditForm({ username: "", password: "", team_ids: [] });
        showModal("User updated successfully", "Success", "success");
      } else {
        const errorData = await teamResponse.json();
        showModal(errorData.error || "Failed to update user teams", "Error", "error");
      }
    } catch (error) {
      showModal("Network error occurred", "Error", "error");
    } finally {
      setUpdating(false);
    }
  };

  // Team management functions
  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!newTeam.name.trim()) {
      showModal("Team name is required", "Error", "error");
      return;
    }

    setCreatingTeam(true);
    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newTeam),
      });

      if (response.ok) {
        const createdTeam = await response.json();
        setTeams([...teams, createdTeam]);
        setNewTeam({ name: "", description: "" });
        setShowCreateTeamForm(false);
        showModal("Team created successfully", "Success", "success");
      } else {
        const errorData = await response.json();
        showModal(errorData.error || "Failed to create team", "Error", "error");
      }
    } catch (error) {
      showModal("Network error occurred", "Error", "error");
    } finally {
      setCreatingTeam(false);
    }
  };

  const handleEditTeam = (team) => {
    setEditingTeam(team.id);
    setEditTeamForm({ name: team.name, description: team.description || "" });
  };

  const handleCancelTeamEdit = () => {
    setEditingTeam(null);
    setEditTeamForm({ name: "", description: "" });
  };

  const handleUpdateTeam = async (teamId) => {
    if (!editTeamForm.name.trim()) {
      showModal("Team name cannot be empty", "Error", "error");
      return;
    }

    setUpdatingTeam(true);
    try {
      const updateData = { 
        name: editTeamForm.name.trim(),
        description: editTeamForm.description.trim()
      };

      const response = await fetch(`/api/teams/${teamId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        const updatedTeam = await response.json();
        setTeams(teams.map(team => 
          team.id === teamId ? updatedTeam : team
        ));
        setEditingTeam(null);
        setEditTeamForm({ name: "", description: "" });
        showModal("Team updated successfully", "Success", "success");
      } else {
        const errorData = await response.json();
        showModal(errorData.error || "Failed to update team", "Error", "error");
      }
    } catch (error) {
      showModal("Network error occurred", "Error", "error");
    } finally {
      setUpdatingTeam(false);
    }
  };

  const handleDeleteTeam = async (teamId) => {
    if (!confirm("Are you sure you want to delete this team?")) return;

    try {
      const response = await fetch(`/api/teams/${teamId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setTeams(teams.filter(team => team.id !== teamId));
        showModal("Team deleted successfully", "Success", "success");
      } else {
        const errorData = await response.json();
        showModal(errorData.error || "Failed to delete team", "Error", "error");
      }
    } catch (error) {
      showModal("Network error occurred", "Error", "error");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (teamDropdownOpen && !event.target.closest('.team-multiselect-container')) {
        setTeamDropdownOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [teamDropdownOpen]);

  if (loading) {
    return <div className="loading">Loading users...</div>;
  }

  return (
    <div className="super-admin-panel">
      <h2>Super Admin Panel</h2>
      {error && <div className="error">{error}</div>}
      
      <div className="user-management">
        <div className="section-header">
          <h3>User Management</h3>
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? "Cancel" : "Create New User"}
          </button>
        </div>

        {showCreateForm && (
          <form onSubmit={handleCreateUser} className="create-user-form">
            <div className="form-group">
              <label htmlFor="username">Username:</label>
              <input
                type="text"
                id="username"
                value={newUser.username}
                onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password:</label>
              <input
                type="password"
                id="password"
                value={newUser.password}
                onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                required
              />
            </div>
            <div className="form-actions">
              <button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create User"}
              </button>
            </div>
          </form>
        )}

        <div className="users-list">
          <h4>Existing Users</h4>
          {users.length === 0 ? (
            <p>No users found.</p>
          ) : (
            <table className="users-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Username</th>
                  <th>Team</th>
                  <th>Date Created / Password</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td>
                      {editingUser === user.id ? (
                        <input
                          type="text"
                          value={editForm.username}
                          onChange={(e) => setEditForm({...editForm, username: e.target.value})}
                          className="edit-input"
                        />
                      ) : (
                        user.username
                      )}
                    </td>
                    <td>
                      {editingUser === user.id ? (
                        <div className="team-multiselect-container">
                          <div className="team-multiselect-trigger" onClick={handleDropdownToggle}>
                            <div className="selected-teams-display">
                              {editForm.team_ids.length > 0 ? (
                                <span className="selected-count">{editForm.team_ids.length} team(s) selected</span>
                              ) : (
                                <span className="no-selection">Select teams...</span>
                              )}
                            </div>
                            <div className="dropdown-arrow">{teamDropdownOpen ? "▲" : "▼"}</div>
                          </div>
                          
                          {teamDropdownOpen && (
                            <div 
                              className="team-multiselect-dropdown"
                              style={{
                                top: `${dropdownPosition.top}px`,
                                left: `${dropdownPosition.left}px`
                              }}
                            >
                              <div className="team-search-container">
                                <input
                                  type="text"
                                  placeholder="Search teams..."
                                  value={teamSearchTerm}
                                  onChange={(e) => setTeamSearchTerm(e.target.value)}
                                  className="team-search-input"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              <div className="team-options-container">
                                {filteredTeams.length > 0 ? (
                                  filteredTeams.map(team => (
                                    <label key={team.id} className="team-option">
                                      <input
                                        type="checkbox"
                                        checked={editForm.team_ids.includes(team.id)}
                                        onChange={() => handleTeamToggle(team.id)}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <span className="team-option-label">{team.name}</span>
                                    </label>
                                  ))
                                ) : (
                                  <div className="no-teams-found">No teams found</div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {editForm.team_ids.length > 0 && (
                            <div className="selected-teams-preview">
                              {teams
                                .filter(team => editForm.team_ids.includes(team.id))
                                .map(team => (
                                  <span key={team.id} className="team-badge-small">{team.name}</span>
                                ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="user-teams">
                          {user.teams && user.teams.length > 0 ? (
                            user.teams.map(team => (
                              <span key={team.id} className="team-badge">{team.name}</span>
                            ))
                          ) : (
                            <span className="no-teams">No Teams</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      {editingUser === user.id ? (
                        <div className="password-edit">
                          <input
                            type="password"
                            value={editForm.password}
                            onChange={(e) => setEditForm({...editForm, password: e.target.value})}
                            placeholder="New password (optional)"
                            className="edit-input"
                          />
                          <small className="password-hint">Leave blank to keep current password</small>
                        </div>
                      ) : (
                        new Date(user.date_created).toLocaleDateString()
                      )}
                    </td>
                    <td>
                      {editingUser === user.id ? (
                        <div className="edit-actions">
                          <button 
                            className="btn btn-success btn-sm"
                            onClick={() => handleUpdateUser(user.id)}
                            disabled={updating}
                          >
                            {updating ? "Saving..." : "Save"}
                          </button>
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={handleCancelEdit}
                            disabled={updating}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="user-actions">
                          <button 
                            className="btn btn-primary btn-sm"
                            onClick={() => handleEditUser(user)}
                          >
                            Edit
                          </button>
                          <button 
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteUser(user.id)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="team-management">
        <div className="section-header">
          <h3>Team Management</h3>
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateTeamForm(!showCreateTeamForm)}
          >
            {showCreateTeamForm ? "Cancel" : "Create New Team"}
          </button>
        </div>

        {showCreateTeamForm && (
          <form onSubmit={handleCreateTeam} className="create-team-form">
            <div className="form-group">
              <label htmlFor="team-name">Team Name:</label>
              <input
                type="text"
                id="team-name"
                value={newTeam.name}
                onChange={(e) => setNewTeam({...newTeam, name: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="team-description">Description (Optional):</label>
              <textarea
                id="team-description"
                value={newTeam.description}
                onChange={(e) => setNewTeam({...newTeam, description: e.target.value})}
                rows="3"
              />
            </div>
            <div className="form-actions">
              <button type="submit" disabled={creatingTeam}>
                {creatingTeam ? "Creating..." : "Create Team"}
              </button>
            </div>
          </form>
        )}

        <div className="teams-list">
          <h4>Existing Teams</h4>
          {teams.length === 0 ? (
            <p>No teams found.</p>
          ) : (
            <table className="teams-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Members</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teams.map(team => (
                  <tr key={team.id}>
                    <td>{team.id}</td>
                    <td>
                      {editingTeam === team.id ? (
                        <input
                          type="text"
                          value={editTeamForm.name}
                          onChange={(e) => setEditTeamForm({...editTeamForm, name: e.target.value})}
                          className="edit-input"
                        />
                      ) : (
                        team.name
                      )}
                    </td>
                    <td>
                      {editingTeam === team.id ? (
                        <textarea
                          value={editTeamForm.description}
                          onChange={(e) => setEditTeamForm({...editTeamForm, description: e.target.value})}
                          className="edit-input"
                          rows="2"
                        />
                      ) : (
                        team.description || "No description"
                      )}
                    </td>
                    <td>
                      {team.member_count} members
                    </td>
                    <td>
                      {editingTeam === team.id ? (
                        <div className="edit-actions">
                          <button 
                            className="btn btn-success btn-sm"
                            onClick={() => handleUpdateTeam(team.id)}
                            disabled={updatingTeam}
                          >
                            {updatingTeam ? "Saving..." : "Save"}
                          </button>
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={handleCancelTeamEdit}
                            disabled={updatingTeam}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="team-actions">
                          <button 
                            className="btn btn-primary btn-sm"
                            onClick={() => handleEditTeam(team)}
                          >
                            Edit
                          </button>
                          <button 
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteTeam(team.id)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [players, setPlayers] = useState([]);
  const [roster, setRoster] = useState([]);
  const [battles, setBattles] = useState([]);
  const [playerStats, setPlayerStats] = useState({});
  const [seasons, setSeasons] = useState([]);
  const [currentSeason, setCurrentSeason] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState("players");
  const [modal, setModal] = useState({ isOpen: false, title: "", message: "", type: "info" });

  const showModal = (message, title = "Notification", type = "info") => {
    setModal({ isOpen: true, title, message, type });
  };

  const closeModal = () => {
    setModal({ isOpen: false, title: "", message: "", type: "info" });
  };

  const handlePageChange = (page) => {
    // Prevent non-superadmins from accessing super-admin page
    if (page === "super-admin" && !user?.is_superadmin) {
      showModal("Access denied: Super Admin privileges required", "Access Denied", "error");
      return;
    }
    
    // Prevent superadmins from accessing non-admin pages
    if (user?.is_superadmin && page !== "super-admin") {
      showModal("Access denied: Superusers can only access the Super Admin panel", "Access Denied", "error");
      return;
    }
    
    setCurrentPage(page);
  };
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [teams, setTeams] = useState([]);
  const [currentTeam, setCurrentTeam] = useState(null);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/status");
      if (response.ok) {
        const data = await response.json();
        setIsAuthenticated(data.authenticated);
        setUser(data.user);
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      console.error("Error checking auth:", error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch("/logout", {
        method: "POST",
      });
      if (response.ok) {
        window.location.href = "/login";
      }
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const fetchTeams = async () => {
    try {
      const response = await fetch("/api/auth/teams");
      if (response.ok) {
        const data = await response.json();
        setTeams(data);

        // Set current team to first if not already set
        if (!currentTeam && data.length > 0) {
          setCurrentTeam(data[0]);
        }
      } else {
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }
        setError("Failed to fetch teams");
      }
    } catch (error) {
      setError("Network error occurred");
    }
  };

  const fetchSeasons = async () => {
    try {
      const url = currentTeam ? `/api/seasons?team_id=${currentTeam.id}` : "/api/seasons";
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setSeasons(data);

        // Set current season to newest if not already set
        if (!currentSeason && data.length > 0) {
          setCurrentSeason(data[0]); // First item is newest due to desc order
        }

        // If no seasons exist, set loading to false here
        if (data.length === 0) {
          setLoading(false);
        }
      } else {
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }
        setError("Failed to fetch seasons");
        setLoading(false);
      }
    } catch (error) {
      setError("Network error occurred");
      setLoading(false);
    }
  };

  const fetchPlayers = async () => {
    try {
      if (!currentTeam) {
        setError("Please select a team first");
        return;
      }
      setError(""); // Clear any previous errors
      const url = `/api/players?status=active&team_id=${currentTeam.id}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setPlayers(data);
      } else {
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }
        setError("Failed to fetch players");
      }
    } catch (error) {
      setError("Network error occurred");
    }
  };

  const fetchAllPlayers = async () => {
    try {
      if (!currentTeam) {
        setError("Please select a team first");
        return;
      }
      setError(""); // Clear any previous errors
      const url = `/api/players?status=all&team_id=${currentTeam.id}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setPlayers(data);
      } else {
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }
        setError("Failed to fetch players");
      }
    } catch (error) {
      setError("Network error occurred");
    }
  };

  const fetchRoster = async () => {
    if (!currentSeason || !currentTeam) return;

    try {
      const url = `/api/players/roster?season_id=${currentSeason.id}&team_id=${currentTeam.id}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setRoster(data);
      } else {
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }
        setError("Failed to fetch roster");
      }
    } catch (error) {
      setError("Network error occurred");
    } finally {
      setLoading(false);
    }
  };

  const fetchBattles = async () => {
    if (!currentSeason) return;

    try {
      let url = `/api/battles?season_id=${currentSeason.id}`;
      if (currentTeam) {
        url += `&team_id=${currentTeam.id}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setBattles(data);
      } else {
        setError("Failed to fetch battles");
      }
    } catch (error) {
      setError("Network error occurred");
    }
  };

  const fetchPlayerStats = async () => {
    if (!currentSeason || !currentTeam) return;

    try {
      const rosterResponse = await fetch(
        `/api/players/roster?season_id=${currentSeason.id}&team_id=${currentTeam.id}`
      );
      if (rosterResponse.ok) {
        const rosterData = await rosterResponse.json();
        const stats = {};

        await Promise.all(
          rosterData.map(async (player) => {
            const statsResponse = await fetch(
              `/api/players/${player.id}/battle-stats?season_id=${currentSeason.id}`
            );
            if (statsResponse.ok) {
              const playerStatsData = await statsResponse.json();
              stats[player.id] = playerStatsData;
            }
          })
        );

        setPlayerStats(stats);
      }
    } catch (error) {
      setError("Network error occurred");
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchTeams();
    }
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    if (user) {
      if (user.is_superadmin) {
        // Superusers can only access super-admin page
        if (currentPage !== "super-admin") {
          setCurrentPage("super-admin");
        }
        // Superusers don't need team-dependent data, so set loading to false
        setLoading(false);
      } else {
        // Regular users cannot access super-admin page
        if (currentPage === "super-admin") {
          setCurrentPage("players");
        }
      }
    }
  }, [user, currentPage]);

  useEffect(() => {
    if (currentTeam) {
      fetchSeasons();
    }
  }, [currentTeam]);

  useEffect(() => {
    if (!currentTeam) return; // Don't fetch data if no team is selected
    
    if (currentPage === "players") {
      fetchPlayers();
      if (currentSeason) {
        fetchRoster();
        fetchPlayerStats();
      }
    } else if (currentPage === "battles") {
      if (!currentSeason) return;
      fetchBattles();
      fetchRoster();
    } else {
      fetchAllPlayers();
      if (currentSeason) {
        fetchBattles();
      }
    }
  }, [currentPage, currentSeason, currentTeam]);

  const handleTeamChange = (team) => {
    setCurrentTeam(team);
    setCurrentSeason(null); // Reset season when team changes
    setPlayers([]);
    setBattles([]);
    setRoster([]);
    setPlayerStats({});
    setError(""); // Clear any previous errors when team changes
  };

  const handleTeamCreated = (newTeam) => {
    setTeams((prev) => [...prev, newTeam]);
    setCurrentTeam(newTeam);
  };

  const handlePlayerAdded = (newPlayer) => {
    setPlayers((prev) => [...prev, newPlayer]);
  };

  const handlePlayerDeleted = (playerId) => {
    setPlayers((prev) => prev.filter((player) => player.id !== playerId));
    setRoster((prev) => prev.filter((player) => player.id !== playerId));
  };

  const handlePlayerStatusChanged = (updatedPlayer) => {
    setPlayers((prev) =>
      prev.map((player) =>
        player.id === updatedPlayer.id ? updatedPlayer : player
      )
    );
    if (updatedPlayer.status === "inactive") {
      setRoster((prev) =>
        prev.filter((player) => player.id !== updatedPlayer.id)
      );
    }
  };

  const handleAddToRoster = async (playerId, position) => {
    if (!currentSeason) {
      showModal("Please select a season first", "Error", "error");
      return;
    }

    try {
      const response = await fetch(`/api/players/${playerId}/roster`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          position,
          season_id: currentSeason.id,
        }),
      });

      if (response.ok) {
        const updatedPlayer = await response.json();
        setRoster((prev) =>
          [...prev.filter((p) => p.id !== playerId), updatedPlayer].sort(
            (a, b) => a.roster_position - b.roster_position
          )
        );
        fetchPlayerStats();
        // Refetch players to update the available players list
        fetchPlayers();
      } else {
        const errorData = await response.json();
        showModal(
          `Failed to add player to roster: ${
            errorData.error || "Unknown error"
          }`, "Error", "error"
        );
      }
    } catch (error) {
      showModal("Network error occurred", "Error", "error");
    }
  };

  const handleRemoveFromRoster = async (playerId) => {
    try {
      const response = await fetch(`/api/players/${playerId}/roster`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          position: null,
          season_id: currentSeason?.id,
        }),
      });

      if (response.ok) {
        setRoster((prev) => prev.filter((player) => player.id !== playerId));
        setPlayerStats((prev) => {
          const newStats = { ...prev };
          delete newStats[playerId];
          return newStats;
        });
        // Refetch players to update the available players list
        fetchPlayers();
      } else {
        const errorData = await response.json();
        showModal(
          `Failed to remove player from roster: ${
            errorData.error || "Unknown error"
          }`, "Error", "error"
        );
      }
    } catch (error) {
      showModal("Network error occurred", "Error", "error");
    }
  };

  const handleMovePlayer = async (playerId, newPosition) => {
    try {
      const response = await fetch(`/api/players/${playerId}/roster`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          position: newPosition,
          season_id: currentSeason?.id,
        }),
      });

      if (response.ok) {
        fetchRoster();
      } else {
        showModal("Failed to move player", "Error", "error");
      }
    } catch (error) {
      showModal("Network error occurred", "Error", "error");
    }
  };

  const handleSwapPlayers = async (playerId1, playerId2) => {
    try {
      // Get the current positions of both players
      const player1 = roster.find((p) => p.id === playerId1);
      const player2 = roster.find((p) => p.id === playerId2);

      if (!player1 || !player2) {
        showModal("Error: Could not find players to swap", "Error", "error");
        return;
      }

      // Use the new swap endpoint
      const response = await fetch("/api/players/swap-roster", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          player1_id: playerId1,
          player2_id: playerId2,
          season_id: currentSeason?.id,
        }),
      });

      if (response.ok) {
        fetchRoster();
      } else {
        const errorData = await response.json();
        showModal(`Failed to swap players: ${errorData.error || "Unknown error"}`, "Error", "error");
      }
    } catch (error) {
      showModal("Network error occurred", "Error", "error");
    }
  };

  const handleBattleAdded = (newBattle) => {
    setBattles((prev) => [newBattle, ...prev]);
    fetchPlayerStats();
  };

  const handleBattleDeleted = (battleId) => {
    setBattles((prev) => prev.filter((battle) => battle.id !== battleId));
    fetchPlayerStats();
  };

  const handleBattleUpdated = (updatedBattle) => {
    setBattles((prev) =>
      prev.map((battle) =>
        battle.id === updatedBattle.id ? updatedBattle : battle
      )
    );
    fetchPlayerStats();
  };

  const handleSeasonChange = (season) => {
    setCurrentSeason(season);
  };

  const handleSeasonCreated = (newSeason) => {
    setSeasons((prev) => [newSeason, ...prev]);
    setCurrentSeason(newSeason);
  };

  const handleSeasonDeleted = (seasonId) => {
    setSeasons((prev) => prev.filter((season) => season.id !== seasonId));
    // If the deleted season was the current season, set current season to null
    if (currentSeason && currentSeason.id === seasonId) {
      setCurrentSeason(null);
    }
  };

  const handleSeasonUpdated = (updatedSeason) => {
    setSeasons((prev) =>
      prev.map((season) =>
        season.id === updatedSeason.id ? updatedSeason : season
      )
    );
    // If the updated season is the current season, update it too
    if (currentSeason && currentSeason.id === updatedSeason.id) {
      setCurrentSeason(updatedSeason);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (authLoading) {
    return (
      <div className="container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = "/login";
    return null;
  }

  return (
    <div className="container">
      <div className="header">
        <h1>Player Management System</h1>
        <div className="header-controls">
          {!user?.is_superadmin && (
            <TeamSelector
              teams={teams}
              currentTeam={currentTeam}
              onTeamChange={handleTeamChange}
              onCreateTeam={handleTeamCreated}
              showCreateButton={false}
              showModal={showModal}
            />
          )}
          <div className="user-info">
            <span>Welcome, {user?.username}</span>
            {user?.is_superadmin && <span className="superadmin-badge">Super Admin</span>}
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>
      </div>
      <Navigation currentPage={currentPage} onPageChange={handlePageChange} user={user} />
      {error && <div className="error">{error}</div>}

      {user?.is_superadmin ? (
        <SuperAdminPanel showModal={showModal} />
      ) : !currentTeam ? (
        <div className="no-team-message">
          <p>Please select a team to continue.</p>
        </div>
      ) : currentPage === "players" ? (
        <div className="main-content">
          <div className="columns">
            <PlayerList
              players={players}
              onPlayerDeleted={handlePlayerDeleted}
              onAddToRoster={handleAddToRoster}
              roster={roster}
              showModal={showModal}
            />
            <ActiveRoster
              roster={roster}
              onRemoveFromRoster={handleRemoveFromRoster}
              onMovePlayer={handleMovePlayer}
              onSwapPlayers={handleSwapPlayers}
              playerStats={playerStats}
              seasons={seasons}
              currentSeason={currentSeason}
              onSeasonChange={handleSeasonChange}
              onCreateSeason={handleSeasonCreated}
              currentTeam={currentTeam}
            />
          </div>
        </div>
      ) : currentPage === "battles" ? (
        !currentSeason ? (
          <div className="no-season">
            <p>Please select or create a season to manage battles.</p>
            <SeasonSelector
              seasons={seasons}
              currentSeason={currentSeason}
              onSeasonChange={handleSeasonChange}
              onCreateSeason={handleSeasonCreated}
              currentTeam={currentTeam}
              showModal={showModal}
            />
          </div>
        ) : (
          <div className="battles-content">
            <SeasonSelector
              seasons={seasons}
              currentSeason={currentSeason}
              onSeasonChange={handleSeasonChange}
              onCreateSeason={handleSeasonCreated}
              currentTeam={currentTeam}
              showModal={showModal}
            />
            <BattleForm
              roster={roster}
              onBattleAdded={handleBattleAdded}
              currentSeason={currentSeason}
              currentTeam={currentTeam}
            />
            <BattleList
              battles={battles}
              onBattleDeleted={handleBattleDeleted}
              onBattleUpdated={handleBattleUpdated}
              currentSeason={currentSeason}
              showModal={showModal}
            />
          </div>
        )
      ) : (
        <AdminDashboard
          players={players}
          onPlayerStatusChanged={handlePlayerStatusChanged}
          onPlayerDeleted={handlePlayerDeleted}
          onPlayerAdded={handlePlayerAdded}
          seasons={seasons}
          onSeasonDeleted={handleSeasonDeleted}
          onSeasonUpdated={handleSeasonUpdated}
          currentSeason={currentSeason}
          onSeasonChange={handleSeasonChange}
          onCreateSeason={handleSeasonCreated}
          battles={battles}
          onBattleUpdated={handleBattleUpdated}
          currentTeam={currentTeam}
        />
      )}
      <Modal
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
