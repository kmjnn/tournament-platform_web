function nextPowerOfTwo(value) {
  let size = 1;
  while (size < value) size *= 2;
  return size;
}

export function generateSingleEliminationRound(teamIds) {
  const seeded = [...teamIds].sort((a, b) => a - b);
  const bracketSize = nextPowerOfTwo(seeded.length);
  const slots = [...seeded];

  while (slots.length < bracketSize) {
    slots.push(null);
  }

  const matches = [];
  for (let i = 0; i < slots.length; i += 2) {
    const slotA = slots[i];
    const slotB = slots[i + 1];
    if (!slotA && !slotB) continue;

    if (slotA && slotB) {
      matches.push({
        team1Id: slotA,
        team2Id: slotB,
        status: "scheduled",
        winnerId: null,
        score1: null,
        score2: null
      });
      continue;
    }

    const winner = slotA || slotB;
    matches.push({
      team1Id: winner,
      team2Id: winner,
      status: "finished",
      winnerId: winner,
      score1: 1,
      score2: 0
    });
  }

  return matches;
}
