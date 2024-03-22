/**
 * Generates a human-readable analysis of a full game state.
 *
 * @param {array} team1 The table of all members in Team 1 (in arbitrary order).
 * @param {array} team2 The table of all members in Team 2 (in arbitrary order).
 * @param {number} turn Which team picks next (1 or 2).
 * @param {string} opponent The name of the opponent the other team has already picked, if the team picking next has counterpick, otherwise the empty string.
 * @param {array} probabilityTable The numPlayers x numPlayers table of the win probability for each player in Team 1 against each player in Team 2.
 * @return The analysis as a human-readable string.
 * @customfunction
 */
function genAnalysis(team1, team2, turn, opponent = '', probabilityTable) {
  const startTime = new Date().getTime();
  const teams = [team1, team2];
  turn--; // Accounts for 1-indexed input

  const OUTPUT_ROWS = 8, OUTPUT_COLS = 12;
  var output = Array.from(Array(OUTPUT_ROWS)).map(() => new Array(OUTPUT_COLS).fill(''));
  output[0][0] = 'Status';

  function error(msg) {
    output[0][1] = 'ERROR: ' + msg;
    return output;
  }

  var members = [[], []], pools = [new Set(), new Set()];
  for (let t = 0; t < 2; t++) {
    const team = teams[t];
    for (let row = 0; row < team.length; row += 2) {
      const [isAvailable, name] = team[row];
      members[t].push(name);
      if (!isAvailable) continue;
      if (!name)
        return error('A player with empty name has been marked available');
      if (name == opponent)
        return error(`The player ${name} is marked as available, but has already been sent as the opponent`);
      if (pools[t].has(name))
        return error(`Duplicate player ${name} in Team ${t + 1}'s player pool`);
      pools[t].add(name);
    }
    output[t + 1][0] = `Team ${t + 1} Pool`;
    output[t + 1][1] = `(${pools[t].size}) ` + Array.from(pools[t]).join(', ');
  }
  if (opponent && members[1 - turn].indexOf(opponent) == -1)
    return error(`Opponent ${opponent} is not a member of the opposing team`);

  if (!opponent) output[3][0] = `Team ${turn + 1} picks first for this set\n`;
  else output[3][0] = `Team ${turn + 1} counterpicks against ${opponent}\n`;

  var maxDepth = 0, nodes = 0, picks = [];
  function evalState(pools, turn, opponent, depth) {
    maxDepth = Math.max(maxDepth, depth);
    nodes++;
    const nPool = pools[turn];
    var bestScore = [-Infinity, Infinity][turn]; //, prediction = ['N/A'];
    // Returns the pools that would result if the candidate were picked this turn
    function genNextPools(candidate) {
      var nextPools = pools.map(pool => new Set(pool));
      nextPools[turn].delete(candidate);
      return nextPools;
    }
    
    // If one team will not have a player for this set, the match is over.
    if (!opponent && (pools[0].size == 0 || pools[1].size == 0)) {
      if (depth == 0) {
        if (pools[0].size == 0 && pools[1].size == 0)
          output[3][0] = 'GAME OVER - Both teams are out of members';
        else if (pools[0].size == 0)
          output[3][0] = `GAME OVER - Team 1 is out of members, automatically forfeiting ${pools[1].size} sets`;
        else
          output[3][0] = `GAME OVER - Team 2 is out of members, automatically forfeiting ${pools[0].size} sets`;
      }
      return pools[0].size;
    }
    nPool.forEach(candidate => {
      const nextPools = genNextPools(candidate);
      var score;
      if (!opponent)
        // N picks first
        score = evalState(nextPools, 1 - turn, candidate, depth + 1);
      else {
        // N has counterpick
        const i = members[0].indexOf([candidate, opponent][turn]);
        const j = members[1].indexOf([opponent, candidate][turn]);
        const prob = probabilityTable[i][j];
        score = prob * (1 + evalState(nextPools, 0, '', depth + 1)) +
          (1 - prob) * evalState(nextPools, 1, '', depth + 1);
      }
      if (depth == 0) picks.push({candidate: candidate, score: score});
      if (turn == 0 && score > bestScore || turn == 1 && score < bestScore) {
        bestScore = score;
        // bestCandidate = candidate;
      }
    });
    return bestScore;
  }

  const overallEval = evalState(pools, turn, opponent, 0);
  const endTime = new Date().getTime();
  output[5][0] = `Depth`, output[5][1] = maxDepth;
  output[6][0] = `Nodes`, output[6][1] = nodes;
  output[7][0] = `Time (s)`, output[7][1] = (endTime - startTime) / 1000;

  output[1][5] = `Ranked Picks`, output[1][9] = 'Overall', output[1][10] = overallEval;
  output[2][5] = '#', output[2][6] = 'Player', output[2][10] = 'Eval', output[2][11] = 'Loss';
  const PICK_ROW_OFFSET = 3;
  picks.sort((a, b) => {
    if (a.score == b.score) return 0;
    return (a.score - b.score) * [-1, 1][turn]; // Higher scores should be earlier in the list for Team 1
  });
  picks.forEach(({candidate: candidate, score: score}, i) => {
    output[PICK_ROW_OFFSET + i][5] = i + 1;
    output[PICK_ROW_OFFSET + i][6] = candidate;
    output[PICK_ROW_OFFSET + i][10] = score;
    output[PICK_ROW_OFFSET + i][11] = Math.abs(score - overallEval);
  });

  output[0][1] = 'SUCCESS';
  return output;
}
