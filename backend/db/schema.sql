-- Удаляем таблицы (если потребуется пересоздать)
DROP TABLE IF EXISTS venue_bookings, matches, participation_requests, team_members, teams, tournaments, users CASCADE;

-- Пользователи
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    nickname VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) CHECK (role IN ('organizer', 'participant', 'venue_admin')) NOT NULL,
    rating INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Турниры (убрано поле venue_booking_id)
CREATE TABLE tournaments (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    game VARCHAR(100) NOT NULL,
    type VARCHAR(20) CHECK (type IN ('esports', 'sports')) NOT NULL,
    format VARCHAR(20) CHECK (format IN ('single_elim', 'double_elim', 'round_robin')) NOT NULL,
    min_teams INTEGER DEFAULT 2,
    max_teams INTEGER DEFAULT 16,
    registration_deadline TIMESTAMPTZ,
    start_date TIMESTAMPTZ,
    status VARCHAR(20) CHECK (status IN ('draft','registration_open','registration_closed','in_progress','finished','cancelled')) DEFAULT 'draft',
    platform VARCHAR(50),
    server VARCHAR(100),
    discord_link VARCHAR(255),
    venue_required BOOLEAN DEFAULT FALSE,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Команды
CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    captain_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Участники команд
CREATE TABLE team_members (
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (team_id, user_id)
);

-- Заявки на участие
CREATE TABLE participation_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    type VARCHAR(10) CHECK (type IN ('solo', 'team')) NOT NULL,
    status VARCHAR(20) CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Матчи
CREATE TABLE matches (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    round INTEGER,
    team1_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    team2_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    score1 INTEGER,
    score2 INTEGER,
    status VARCHAR(20) CHECK (status IN ('scheduled','live','finished','disputed')) DEFAULT 'scheduled',
    winner_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    start_time TIMESTAMPTZ
);

-- Бронирование площадок
CREATE TABLE venue_bookings (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    venue_name VARCHAR(100),
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    status VARCHAR(20) CHECK (status IN ('requested','approved','rejected')) DEFAULT 'requested'
);

-- ================
-- ИНДЕКСЫ
-- ================
CREATE INDEX idx_tournaments_created_by ON tournaments(created_by);
CREATE INDEX idx_teams_captain ON teams(captain_id);
CREATE INDEX idx_teams_tournament ON teams(tournament_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE INDEX idx_participation_user ON participation_requests(user_id);
CREATE INDEX idx_participation_tournament ON participation_requests(tournament_id);
CREATE INDEX idx_participation_team ON participation_requests(team_id);
CREATE INDEX idx_matches_tournament ON matches(tournament_id);
CREATE INDEX idx_matches_team1 ON matches(team1_id);
CREATE INDEX idx_matches_team2 ON matches(team2_id);
CREATE INDEX idx_matches_winner ON matches(winner_id);
CREATE INDEX idx_venue_bookings_tournament ON venue_bookings(tournament_id);