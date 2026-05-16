const db = require('../config/db');

const TeamModel = {
  async create({ name, captainId, tournamentId }) {
    const res = await db.query(
      'INSERT INTO teams (name, captain_id, tournament_id) VALUES ($1,$2,$3) RETURNING *',
      [name, captainId, tournamentId]
    );
    return res.rows[0];
  },

  async addMember(teamId, userId) {
    await db.query('INSERT INTO team_members (team_id, user_id) VALUES ($1,$2)', [teamId, userId]);
  },

  async findByTournament(tournamentId) {
    const res = await db.query('SELECT * FROM teams WHERE tournament_id=$1', [tournamentId]);
    return res.rows;
  },

  async getMembers(teamId) {
    const res = await db.query(
      `SELECT u.* FROM users u JOIN team_members tm ON u.id = tm.user_id WHERE tm.team_id=$1`,
      [teamId]
    );
    return res.rows;
  }
};

module.exports = TeamModel;