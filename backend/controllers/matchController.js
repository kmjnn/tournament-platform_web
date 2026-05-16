const MatchModel = require('../models/matchModel');
const notificationService = require('../services/notificationService');

exports.updateResult = async (req, res) => {
  const { matchId, score1, score2, winnerId } = req.body;
  await MatchModel.updateResult(matchId, score1, score2, winnerId);
  notificationService.notifyAll('match_finished', { matchId, winnerId });
  res.json({ message: 'Result recorded' });
};