const db = require('../config/db');
const TournamentFactory = require('../factories/tournamentFactory');

const TournamentModel = {
  async create(data, userId) {
    const tournament = TournamentFactory.createTournament(data, userId);
    
    // Приводим даты к формату, который понимает PostgreSQL
    if (tournament.registration_deadline) {
      tournament.registration_deadline = new Date(tournament.registration_deadline).toISOString().replace('T', ' ').replace('Z', '');
    }
    if (tournament.start_date) {
      tournament.start_date = new Date(tournament.start_date).toISOString().replace('T', ' ').replace('Z', '');
    }
    const fields = Object.keys(tournament);
    const values = Object.values(tournament);
    const placeholders = fields.map((_, i) => '$' + (i + 1));
    const sql = `INSERT INTO tournaments (${fields.join(',')}) VALUES (${placeholders}) RETURNING *`;
    const res = await db.query(sql, values);
    return res.rows[0];
  },

  async findAll() {
    const res = await db.query('SELECT * FROM tournaments ORDER BY start_date DESC');
    return res.rows;
  },

  async findById(id) {
    const res = await db.query('SELECT * FROM tournaments WHERE id=$1', [id]);
    return res.rows[0];
  },

  async updateStatus(id, status) {
    await db.query('UPDATE tournaments SET status=$1 WHERE id=$2', [status, id]);
  },

  async reschedule(id, newDate) {
    await db.query('UPDATE tournaments SET start_date=$1 WHERE id=$2', [newDate, id]);
  },
  
  async createRaw(tournamentData) {
  const fields = Object.keys(tournamentData);
  const values = Object.values(tournamentData);
  const placeholders = fields.map((_, i) => '$' + (i + 1));
  
  // Преобразуем даты, если есть
  if (tournamentData.registration_deadline) {
    tournamentData.registration_deadline = new Date(tournamentData.registration_deadline).toISOString();
  }
  if (tournamentData.start_date) {
    tournamentData.start_date = new Date(tournamentData.start_date).toISOString();
  }
  
  const sql = `INSERT INTO tournaments (${fields.join(',')}) VALUES (${placeholders}) RETURNING *`;
  const res = await db.query(sql, values);
  return res.rows[0];
},
async getRequests(tournamentId) {
  const res = await db.query(
    `SELECT pr.*, u.nickname as user_nickname, t.name as team_name
     FROM participation_requests pr
     JOIN users u ON pr.user_id = u.id
     LEFT JOIN teams t ON pr.team_id = t.id
     WHERE pr.tournament_id=$1`,
    [tournamentId]
  );
  return res.rows;
},
async getApprovedTeams(tournamentId) {
  const res = await db.query(
    `SELECT t.*, u.nickname as captain_nickname
     FROM teams t
     JOIN users u ON t.captain_id = u.id
     WHERE t.tournament_id=$1
       AND EXISTS (SELECT 1 FROM participation_requests pr WHERE pr.team_id = t.id AND pr.status='approved')`,
    [tournamentId]
  );
  return res.rows;
}

};

module.exports = TournamentModel;