class TournamentFactory {
  static createTournament(data, userId) {
    const base = {
      title: data.title,
      description: data.description,
      game: data.game,
      type: data.type,
      format: data.format,
      min_teams: data.minTeams || 2,
      max_teams: data.maxTeams || 16,
      registration_deadline: data.registrationDeadline,
      start_date: data.startDate,
      created_by: userId
    };

    if (data.type === 'esports') {
      return { ...base, platform: data.platform || null };
    }
    return base;
  }
}

module.exports = TournamentFactory;