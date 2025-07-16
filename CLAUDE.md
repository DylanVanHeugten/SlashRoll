# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Environment Setup
```bash
# Activate virtual environment (use venv-wsl for WSL environments)
source venv-wsl/bin/activate  # WSL/Linux
source venv/bin/activate      # Standard Linux/Mac
venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt
```

### Running the Application
```bash
# Start development server
python app.py
```
The application runs on `http://localhost:5000` with debug mode enabled. Database migrations run automatically on startup.

## Architecture Overview

### Tech Stack
- **Backend**: Flask with SQLAlchemy ORM, SQLite database
- **Frontend**: React 18 (CDN) with Babel standalone for in-browser JSX transpilation
- **Styling**: Vanilla CSS with CSS Grid and Flexbox

### Application Structure

**Single-Page Application Flow**:
The app has three main views controlled by client-side navigation:
1. **Main View**: Player creation form, active players list, and 20-slot roster with battle stats
2. **Battles View**: Battle recording form and battle history
3. **Management View**: Comprehensive player management with status controls

**Database Design**:
- `Season` table for season management with name and creation date
- `Player` table with status-based filtering, optional unique game_id, and season association
- `SeasonRoster` table for many-to-many relationship between seasons and players with roster positions
- `Battle` table tracking enemy encounters with scores, power rankings, and season association
- `BattleParticipant` table linking players to battles with damage/shield stats
- Players can be assigned to roster positions (1-20) per season
- Battle statistics are aggregated and displayed on roster cards

**State Management Architecture**:
- React hooks for component state (`useState`, `useEffect`)
- Separate API calls for different data views (active players vs all players)
- Real-time roster updates through optimistic UI updates

### Key Backend Patterns

**RESTful API with Season and Status Filtering**:
- `GET /api/players?status=active&season_id=X` - Main view (default)
- `GET /api/players?status=all` - Management view with all seasons data
- `GET /api/players/roster?season_id=X` - Season-specific roster endpoint
- `GET /api/battles?season_id=X` - Season-filtered battle history
- `POST /api/battles` - Create battle with participant stats and season association
- `GET /api/players/<id>/battle-stats?season_id=X` - Season-specific player statistics
- `GET /api/seasons` - Season management endpoints
- `POST /api/seasons` - Create new season
- `GET /api/seasons/current` - Get most recent season

**Season-Based Roster Management**:
- Positions 1-20 are exclusive per season (replacing existing player if position taken)
- Position validation ensures roster stays within 20-slot limit per season
- Drag-and-drop reordering updates positions atomically
- Players can be in multiple seasons with different roster positions

**Database Migration System**:
Custom migration runner in `run_migrations()` that:
- Checks for missing columns by attempting SELECT queries
- Adds columns with appropriate defaults if missing
- Creates new tables (Season, SeasonRoster, Battle, BattleParticipant) if they don't exist
- Updates existing records to maintain data integrity
- Migrates existing roster data to new season-based system

**Battle Statistics Aggregation**:
- Real-time calculation of total damage, shields broken, and battles participated
- Statistics displayed on roster cards for quick reference
- Battle history with win/loss/tie tracking based on score comparison

### Frontend Component Architecture

**Season-Aware Navigation UI**:
- `Navigation` component controls view switching between Main, Battles, and Management
- `SeasonSelector` component manages season creation and selection
- `App` component manages global state and API calls with season context
- Different data fetching strategies per view with season filtering

**Roster Management Flow**:
1. `PlayerList` shows active players with "Add to Roster" actions
2. `ActiveRoster` displays 20-slot grid with drag-and-drop and battle statistics
3. Position conflicts resolved automatically on backend

**Battle Recording Flow**:
1. `BattleForm` allows recording enemy encounters with participant stats
2. `BattleList` displays battle history with win/loss indicators
3. Battle statistics automatically update player roster cards

**Player Lifecycle**:
- Created as "active" by default with optional unique game_id
- Can be moved to roster (assigned position 1-20) per season
- Battle participation tracked with damage/shield statistics per season
- Can be deactivated (removes from roster, hidden from main view)
- Deletion only available from management view
- GameID uniqueness validation prevents duplicate assignments

### Development Patterns

**Frontend State Synchronization**:
- Separate state for `players` (filtered by current view) and `roster`
- Season-aware state management with automatic season context
- API calls trigger state updates with optimistic UI feedback
- Error handling through HTML error messages and alert dialogs

**Database Schema Evolution**:
- Column additions handled through migration system
- No down migrations - schema only grows
- Default values ensure existing data remains valid

### Key Features

**Season Management System**:
- Multiple seasons with isolated data and rosters
- Season selector with creation functionality
- Historical data preservation across seasons
- Automatic season context in all operations

**GameID System**:
- Optional unique identifier for players
- Uniqueness validation with clear error messages
- Subtle display in player lists as "#GameID"
- Inline editing in management interface

**Player Management Interface**:
- Three-view system: Main (active players), Battles (recording), Management (all players)
- Status-based filtering (active/inactive)
- Season participation tracking with tooltip display
- Comprehensive player lifecycle management

**Battle Recording System**:
- Enemy encounter tracking with power rankings
- Individual player performance metrics
- Damage/shield statistics aggregation
- Win/loss/tie determination with score comparison

### Current Implementation Notes
- No build process - direct JSX transpilation in browser
- No testing framework or linting tools configured
- Mobile-responsive design using CSS Grid and media queries
- CORS enabled for development flexibility
- SQLite database with automatic migrations on startup