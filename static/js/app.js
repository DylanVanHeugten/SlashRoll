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

function SeasonSelector({
  seasons,
  currentSeason,
  onSeasonChange,
  onCreateSeason,
  showCreateButton = false,
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
        body: JSON.stringify({ name: newSeasonName.trim() }),
      });

      if (response.ok) {
        const newSeason = await response.json();
        onCreateSeason(newSeason);
        setNewSeasonName("");
        setShowCreateForm(false);
      } else {
        alert("Failed to create season");
      }
    } catch (error) {
      alert("Network error occurred");
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

function Navigation({ currentPage, onPageChange }) {
  return (
    <nav className="navigation">
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
        className={currentPage === "statistics" ? "active" : ""}
        onClick={() => onPageChange("statistics")}
      >
        Statistics
      </button>
      <button
        className={currentPage === "manage" ? "active" : ""}
        onClick={() => onPageChange("manage")}
      >
        Administrator Dashboard
      </button>
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

function PlayerForm({ onPlayerAdded, currentSeason }) {
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

function PlayerList({ players, onPlayerDeleted, onAddToRoster, roster }) {
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
        alert("Failed to delete player");
      }
    } catch (error) {
      alert("Network error occurred");
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddToRoster = (playerId) => {
    if (roster.length >= 20) {
      alert("Roster is full (20 players maximum)");
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

function BattleForm({ roster, onBattleAdded, currentSeason }) {
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

function BattleList({ battles, onBattleDeleted, onBattleUpdated, currentSeason }) {
  const [deletingId, setDeletingId] = useState(null);
  const [editingBattle, setEditingBattle] = useState(null);

  const handleDelete = async (battleId) => {
    if (!confirm("Are you sure you want to delete this battle?")) return;

    setDeletingId(battleId);

    try {
      const response = await fetch(`/api/battles/${battleId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        onBattleDeleted(battleId);
      } else {
        alert("Failed to delete battle");
      }
    } catch (error) {
      alert("Network error occurred");
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

function Statistics({
  roster,
  players,
  battles,
  currentSeason,
  seasons,
  onSeasonChange,
  onCreateSeason,
}) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [playerStats, setPlayerStats] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentSeason && roster.length > 0) {
      fetchAllPlayerStats();
    }
  }, [currentSeason, roster]);

  const fetchAllPlayerStats = async () => {
    setLoading(true);
    try {
      const stats = {};
      await Promise.all(
        roster.map(async (player) => {
          const response = await fetch(
            `/api/players/${player.id}/battle-stats?season_id=${currentSeason.id}`
          );
          if (response.ok) {
            const data = await response.json();
            stats[player.id] = data;
          }
        })
      );
      setPlayerStats(stats);
    } catch (error) {
      console.error("Failed to fetch player stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateSeasonStats = () => {
    if (!currentSeason || battles.length === 0) return null;

    const wins = battles.filter((b) => b.our_score > b.their_score).length;
    const losses = battles.filter((b) => b.our_score < b.their_score).length;
    const totalDamage = battles.reduce(
      (sum, battle) => sum + (battle.total_damage || 0),
      0
    );
    const avgDamage = battles.length > 0 ? totalDamage / battles.length : 0;

    return {
      totalBattles: battles.length,
      wins,
      losses,
      winRate:
        battles.length > 0 ? ((wins / battles.length) * 100).toFixed(1) : 0,
      totalDamage,
      avgDamage,
    };
  };

  const getTopPlayers = () => {
    const players = Object.entries(playerStats)
      .map(([playerId, stats]) => ({
        playerId,
        name:
          roster.find((p) => p.id === parseInt(playerId))?.name || "Unknown",
        ...stats,
      }))
      .sort((a, b) => b.total_damage - a.total_damage);

    return players.slice(0, 10);
  };

  const seasonStats = calculateSeasonStats();
  const topPlayers = getTopPlayers();

  return (
    <div className="statistics-content">
      <h2>Statistics</h2>

      <SeasonSelector
        seasons={seasons}
        currentSeason={currentSeason}
        onSeasonChange={onSeasonChange}
        onCreateSeason={onCreateSeason}
      />

      {!currentSeason ? (
        <div className="no-season">
          <p>Please select a season to view statistics.</p>
        </div>
      ) : (
        <div className="stats-dashboard">
          <div className="dashboard-sections">
            <div className="dashboard-section">
              <h3>Season Overview</h3>
              {seasonStats ? (
                <div className="season-stats">
                  <div className="stat-cards">
                    <div className="stat-card">
                      <h4>Total Battles</h4>
                      <span className="stat-value">
                        {seasonStats.totalBattles}
                      </span>
                    </div>
                    <div className="stat-card">
                      <h4>Win Rate</h4>
                      <span className="stat-value">{seasonStats.winRate}%</span>
                    </div>
                    <div className="stat-card">
                      <h4>Wins</h4>
                      <span className="stat-value wins">
                        {seasonStats.wins}
                      </span>
                    </div>
                    <div className="stat-card">
                      <h4>Losses</h4>
                      <span className="stat-value losses">
                        {seasonStats.losses}
                      </span>
                    </div>
                    <div className="stat-card">
                      <h4>Total Damage</h4>
                      <span className="stat-value">
                        {formatDamage(seasonStats.totalDamage)}
                      </span>
                    </div>
                    <div className="stat-card">
                      <h4>Avg Damage/Battle</h4>
                      <span className="stat-value">
                        {formatDamage(Math.round(seasonStats.avgDamage))}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p>No battles recorded for this season.</p>
              )}
            </div>

            <div className="dashboard-section">
              <h3>Top Players</h3>
              {loading ? (
                <p>Loading player statistics...</p>
              ) : topPlayers.length > 0 ? (
                <div className="top-players">
                  <div className="players-stats-table">
                    <div className="table-header">
                      <div>Rank</div>
                      <div>Player</div>
                      <div>Total Damage</div>
                      <div>Shields Broken</div>
                      <div>Battles</div>
                      <div>Avg Damage</div>
                    </div>
                    {topPlayers.map((player, index) => (
                      <div key={player.playerId} className="table-row">
                        <div className="rank">#{index + 1}</div>
                        <div className="player-name">{player.name}</div>
                        <div className="total-damage">
                          {formatDamage(player.total_damage)}
                        </div>
                        <div>{formatDamage(player.total_shields_broken)}</div>
                        <div>{player.battles_participated}</div>
                        <div>
                          {formatDamage(
                            Math.round(
                              player.total_damage /
                                Math.max(1, player.battles_participated)
                            )
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p>No player statistics available.</p>
              )}
            </div>

            <div className="dashboard-section">
              <h3>Recent Battles</h3>
              {battles.length > 0 ? (
                <div className="recent-battles">
                  <div className="battles-table">
                    <div className="table-header">
                      <div>Date</div>
                      <div>Enemy</div>
                      <div>Score</div>
                      <div>Result</div>
                      <div>Total Damage</div>
                    </div>
                    {battles.slice(0, 10).map((battle) => (
                      <div key={battle.id} className="table-row">
                        <div>
                          {new Date(battle.date_created).toLocaleDateString()}
                        </div>
                        <div>{battle.enemy_name}</div>
                        <div>
                          {battle.our_score} - {battle.their_score}
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
                        <div className="total-damage">
                          {formatDamage(battle.total_damage || 0)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p>No battles recorded for this season.</p>
              )}
            </div>
          </div>
        </div>
      )}
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

  const fetchSeasons = async () => {
    try {
      const response = await fetch("/api/seasons");
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
      const url = `/api/players?status=active`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setPlayers(data);
      } else {
        setError("Failed to fetch players");
      }
    } catch (error) {
      setError("Network error occurred");
    }
  };

  const fetchAllPlayers = async () => {
    try {
      const url = `/api/players?status=all`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setPlayers(data);
      } else {
        setError("Failed to fetch players");
      }
    } catch (error) {
      setError("Network error occurred");
    }
  };

  const fetchRoster = async () => {
    if (!currentSeason) return;

    try {
      const url = `/api/players/roster?season_id=${currentSeason.id}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setRoster(data);
      } else {
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
      const url = `/api/battles?season_id=${currentSeason.id}`;
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
    if (!currentSeason) return;

    try {
      const rosterResponse = await fetch(
        `/api/players/roster?season_id=${currentSeason.id}`
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
    fetchSeasons();
  }, []);

  useEffect(() => {
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
    } else if (currentPage === "statistics") {
      if (currentSeason) {
        fetchBattles();
        fetchRoster();
      }
    } else {
      fetchAllPlayers();
      if (currentSeason) {
        fetchBattles();
      }
    }
  }, [currentPage, currentSeason]);

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
      alert("Please select a season first");
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
        alert(
          `Failed to add player to roster: ${
            errorData.error || "Unknown error"
          }`
        );
      }
    } catch (error) {
      alert("Network error occurred");
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
        alert(
          `Failed to remove player from roster: ${
            errorData.error || "Unknown error"
          }`
        );
      }
    } catch (error) {
      alert("Network error occurred");
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
        alert("Failed to move player");
      }
    } catch (error) {
      alert("Network error occurred");
    }
  };

  const handleSwapPlayers = async (playerId1, playerId2) => {
    try {
      // Get the current positions of both players
      const player1 = roster.find((p) => p.id === playerId1);
      const player2 = roster.find((p) => p.id === playerId2);

      if (!player1 || !player2) {
        alert("Error: Could not find players to swap");
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
        alert(`Failed to swap players: ${errorData.error || "Unknown error"}`);
      }
    } catch (error) {
      alert("Network error occurred");
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

  return (
    <div className="container">
      <h1>Player Management System</h1>
      <Navigation currentPage={currentPage} onPageChange={setCurrentPage} />
      {error && <div className="error">{error}</div>}

      {currentPage === "players" ? (
        <div className="main-content">
          <div className="columns">
            <PlayerList
              players={players}
              onPlayerDeleted={handlePlayerDeleted}
              onAddToRoster={handleAddToRoster}
              roster={roster}
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
            />
          </div>
        ) : (
          <div className="battles-content">
            <SeasonSelector
              seasons={seasons}
              currentSeason={currentSeason}
              onSeasonChange={handleSeasonChange}
              onCreateSeason={handleSeasonCreated}
            />
            <BattleForm
              roster={roster}
              onBattleAdded={handleBattleAdded}
              currentSeason={currentSeason}
            />
            <BattleList
              battles={battles}
              onBattleDeleted={handleBattleDeleted}
              onBattleUpdated={handleBattleUpdated}
              currentSeason={currentSeason}
            />
          </div>
        )
      ) : currentPage === "statistics" ? (
        <Statistics
          roster={roster}
          players={players}
          battles={battles}
          currentSeason={currentSeason}
          seasons={seasons}
          onSeasonChange={handleSeasonChange}
          onCreateSeason={handleSeasonCreated}
        />
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
        />
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
