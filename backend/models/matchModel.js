const db = require('../config/db');

const MatchModel = {
  async createMany(matches) {
    for (const m of matches) {
      await db.query(
        `INSERT INTO matches (tournament_id, round, team1_id, team2_id, status, winner_id)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [m.tournamentId, m.round, m.team1Id, m.team2Id, m.status, m.winnerId || null]
      );
    }
  },

  async findByTournament(tournamentId) {
    const res = await db.query('SELECT * FROM matches WHERE tournament_id=$1 ORDER BY round', [tournamentId]);
    return res.rows;
  },

  async updateResult(matchId, score1, score2, winnerId) {
    await db.query(
      `UPDATE matches SET score1=$1, score2=$2, winner_id=$3, status='finished' WHERE id=$4`,
      [score1, score2, winnerId, matchId]
    );
  }
};

module.exports = MatchModel;