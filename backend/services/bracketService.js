// Интерфейс стратегии генерации сетки
class BracketStrategy {
  generate(teams, tournamentId) {
    throw new Error('Not implemented');
  }
}

class SingleEliminationStrategy extends BracketStrategy {
  generate(teams, tournamentId) {
    // Предполагаем, что teams - массив { id }
    const matches = [];
    const shuffled = [...teams].sort(() => Math.random() - 0.5); // можно рандом
    for (let i = 0; i < shuffled.length; i += 2) {
      if (i + 1 < shuffled.length) {
        matches.push({
          tournamentId,
          round: 1,
          team1Id: shuffled[i].id,
          team2Id: shuffled[i + 1].id,
          status: 'scheduled'
        });
      } else {
        // нечётное число команд — bye
        matches.push({
          tournamentId,
          round: 1,
          team1Id: shuffled[i].id,
          team2Id: null,
          status: 'scheduled',
          winnerId: shuffled[i].id // автоматически проходит дальше
        });
      }
    }
    return matches;
  }
}

// Контекст
class BracketGenerator {
  constructor(strategy) {
    this.strategy = strategy;
  }

  setStrategy(strategy) {
    this.strategy = strategy;
  }

  generate(teams, tournamentId) {
    return this.strategy.generate(teams, tournamentId);
  }
}

module.exports = { SingleEliminationStrategy, BracketGenerator };