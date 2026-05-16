/**
 * Сервис генерации турнирных сеток
 * Поддерживает форматы: Single Elimination, Double Elimination, Round Robin
 */

class BracketStrategy {
    /**
     * Генерирует полную сетку матчей для турнира
     * @param {Array} teams - массив команд [{ id, name }]
     * @param {number} tournamentId - ID турнира
     * @returns {Array} массив объектов матчей для вставки в БД
     */
    generate(teams, tournamentId) {
        throw new Error('Метод generate должен быть переопределён');
    }
}

class SingleEliminationStrategy extends BracketStrategy {
    generate(teams, tournamentId) {
        const matches = [];
        // Перемешиваем команды для случайного распределения
        const shuffled = [...teams].sort(() => Math.random() - 0.5);
        const numTeams = shuffled.length;

        // Вычисляем ближайшую степень двойки для определения размера сетки
        const bracketSize = Math.pow(2, Math.ceil(Math.log2(numTeams)));
        const byeCount = bracketSize - numTeams;

        // Создаём матчи первого раунда
        let round = 1;
        let teamIndex = 0;

        // Обрабатываем BYE (команды, которые проходят автоматически)
        const byeMatches = [];
        for (let i = 0; i < byeCount; i++) {
            if (teamIndex < numTeams) {
                byeMatches.push({
                    tournamentId,
                    round: 1,
                    team1Id: shuffled[teamIndex].id,
                    team2Id: null,
                    status: 'scheduled',
                    winnerId: shuffled[teamIndex].id // автоматически проходит
                });
                teamIndex++;
            }
        }

        // Создаём обычные матчи первого раунда
        const firstRoundMatches = [];
        while (teamIndex < numTeams - 1) {
            firstRoundMatches.push({
                tournamentId,
                round: 1,
                team1Id: shuffled[teamIndex].id,
                team2Id: shuffled[teamIndex + 1].id,
                status: 'scheduled',
                winnerId: null
            });
            teamIndex += 2;
        }

        matches.push(...byeMatches, ...firstRoundMatches);

        // Строим последующие раунды (пустые заглушки)
        const totalFirstRoundSlots = byeMatches.length + firstRoundMatches.length;
        let slotsInCurrentRound = totalFirstRoundSlots;

        while (slotsInCurrentRound > 1) {
            round++;
            slotsInCurrentRound = Math.floor(slotsInCurrentRound / 2);
            for (let i = 0; i < slotsInCurrentRound; i++) {
                matches.push({
                    tournamentId,
                    round,
                    team1Id: null, // будет заполнено после завершения предыдущего раунда
                    team2Id: null,
                    status: 'scheduled',
                    winnerId: null
                });
            }
        }

        return matches;
    }
}

class DoubleEliminationStrategy extends BracketStrategy {
    generate(teams, tournamentId) {
        const matches = [];
        const numTeams = teams.length;
        const shuffled = [...teams].sort(() => Math.random() - 0.5);

        // Верхняя сетка (Winners Bracket) — как Single Elimination
        const bracketSize = Math.pow(2, Math.ceil(Math.log2(numTeams)));
        const byeCount = bracketSize - numTeams;

        // Winners Bracket - Round 1
        let teamIndex = 0;
        let wbRound = 1;

        // BYE в верхней сетке
        for (let i = 0; i < byeCount; i++) {
            if (teamIndex < numTeams) {
                matches.push({
                    tournamentId,
                    round: wbRound,
                    team1Id: shuffled[teamIndex].id,
                    team2Id: null,
                    status: 'scheduled',
                    winnerId: shuffled[teamIndex].id,
                    bracket: 'winners'
                });
                teamIndex++;
            }
        }

        // Обычные матчи первого раунда верхней сетки
        while (teamIndex < numTeams - 1) {
            matches.push({
                tournamentId,
                round: wbRound,
                team1Id: shuffled[teamIndex].id,
                team2Id: shuffled[teamIndex + 1].id,
                status: 'scheduled',
                winnerId: null,
                bracket: 'winners'
            });
            teamIndex += 2;
        }

        // Losers Bracket - Round 1 (проигравшие первого раунда WB)
        const losersRound1Count = Math.floor(numTeams / 2);
        for (let i = 0; i < losersRound1Count; i++) {
            matches.push({
                tournamentId,
                round: 1,
                team1Id: null, // проигравший матча WB
                team2Id: null, // проигравший другого матча WB
                status: 'scheduled',
                winnerId: null,
                bracket: 'losers'
            });
        }

        return matches;
    }
}

class RoundRobinStrategy extends BracketStrategy {
    generate(teams, tournamentId) {
        const matches = [];
        const n = teams.length;

        // Алгоритм кругового турнира (round-robin)
        // Каждая команда играет с каждой
        for (let round = 1; round < n; round++) {
            for (let i = 0; i < n / 2; i++) {
                const team1Idx = i;
                const team2Idx = n - 1 - i;

                if (team1Idx < n && team2Idx < n && team1Idx !== team2Idx) {
                    matches.push({
                        tournamentId,
                        round,
                        team1Id: teams[team1Idx].id,
                        team2Id: teams[team2Idx].id,
                        status: 'scheduled',
                        winnerId: null,
                        bracket: 'groups'
                    });
                }
            }
            // Ротация команд для следующего раунда
            const last = teams.pop();
            teams.splice(1, 0, last);
        }

        return matches;
    }
}

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

    /**
     * Фабричный метод для получения стратегии по формату турнира
     */
    static getStrategy(format) {
        switch (format) {
            case 'single_elim':
                return new SingleEliminationStrategy();
            case 'double_elim':
                return new DoubleEliminationStrategy();
            case 'round_robin':
                return new RoundRobinStrategy();
            default:
                throw new Error(`Неизвестный формат турнира: ${format}`);
        }
    }
}

module.exports = {
    BracketGenerator,
    SingleEliminationStrategy,
    DoubleEliminationStrategy,
    RoundRobinStrategy
};