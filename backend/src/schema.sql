CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  nickname VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('organizer', 'participant')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tournaments (
  id SERIAL PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  game VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('esports', 'sports')),
  format VARCHAR(20) NOT NULL CHECK (format IN ('single_elim', 'double_elim', 'round_robin')),
  min_teams INTEGER NOT NULL DEFAULT 2,
  max_teams INTEGER NOT NULL DEFAULT 16,
  registration_deadline TIMESTAMPTZ NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'registration_open',
  created_by INTEGER REFERENCES users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  registered_by INTEGER REFERENCES users(id) NOT NULL,
  tournament_id INTEGER REFERENCES tournaments(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id INTEGER REFERENCES teams(id) NOT NULL,
  user_id INTEGER REFERENCES users(id) NOT NULL,
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS participation_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) NOT NULL,
  team_id INTEGER REFERENCES teams(id),
  tournament_id INTEGER REFERENCES tournaments(id) NOT NULL,
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('solo', 'team')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  looking_for_team BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER REFERENCES tournaments(id) NOT NULL,
  round INTEGER NOT NULL,
  team1_id INTEGER REFERENCES teams(id) NOT NULL,
  team2_id INTEGER REFERENCES teams(id) NOT NULL,
  score1 INTEGER,
  score2 INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'finished')),
  winner_id INTEGER REFERENCES teams(id),
  start_time TIMESTAMPTZ
);
