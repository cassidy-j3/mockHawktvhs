import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const basePort = Number(process.env.PORT) || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// In-memory state for now; swap with SQLite later.
const state = {
  schools: [],
  matches: [],
  matchesRound2: [],
  matchesRound3: [],
  round3Confirmed: false,
  matchesRound4: [],
  round4Confirmed: false,
  scores: [],
  results: [],
  judges: [],
  rooms: [],
  nextSchoolId: 1,
  nextTeamId: 1,
  nextMatchId: 1,
  nextJudgeId: 1,
  nextRoomId: 1
};

function getTeams() {
  return state.schools.flatMap((school) =>
    school.teams.map((team) => ({
      ...team,
      schoolName: school.name
    }))
  );
}

function teamLabel(team) {
  if (!team) return "Team TBD";
  return `${team.schoolName} - ${team.name} (${team.code})`;
}

function teamCode(team) {
  if (!team) return "TBD";
  return team.code;
}

function matchView(match, teamsById, judgesById, round) {
  const prosecution = teamsById.get(match.prosecutionTeamId);
  const defense = teamsById.get(match.defenseTeamId);
  const judge = judgesById ? judgesById.get(match.judgeId) : null;
  return {
    id: match.id,
    courtroom: match.courtroom,
    prosecutionLabel: prosecution ? teamLabel(prosecution) : "Team TBD",
    defenseLabel: defense ? teamLabel(defense) : "BYE",
    prosecutionCode: teamCode(prosecution),
    defenseCode: teamCode(defense),
    judgeName: judge ? judge.name : "Unassigned",
    round
  };
}

function generateTeamCode(existingCodes) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  let tries = 0;
  while (!code || existingCodes.has(code)) {
    const a = letters[Math.floor(Math.random() * letters.length)];
    const b = letters[Math.floor(Math.random() * letters.length)];
    code = `${a}${b}`;
    tries += 1;
    if (tries > 2000) {
      break;
    }
  }
  return code;
}

function generateJudgePin(existingPins) {
  let pin = "";
  let tries = 0;
  while (!pin || existingPins.has(pin)) {
    pin = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    tries += 1;
    if (tries > 2000) {
      break;
    }
  }
  return pin;
}

function addSchool(name) {
  const school = {
    id: state.nextSchoolId++,
    name,
    teams: []
  };
  state.schools.push(school);
  return school;
}

function addTeam(school, name) {
  const existingCodes = new Set(
    state.schools.flatMap((s) => s.teams.map((t) => t.code))
  );
  const code = generateTeamCode(existingCodes);
  const team = {
    id: state.nextTeamId++,
    name,
    code
  };
  school.teams.push(team);
  return team;
}

function addJudge(name) {
  const existingPins = new Set(state.judges.map((j) => j.pin));
  const pin = generateJudgePin(existingPins);
  const judge = {
    id: state.nextJudgeId++,
    name,
    pin
  };
  state.judges.push(judge);
  return judge;
}

function addRoom(label) {
  const room = {
    id: state.nextRoomId++,
    label
  };
  state.rooms.push(room);
  return room;
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
}

function buildPairSet(matches) {
  const set = new Set();
  for (const match of matches) {
    if (!match.defenseTeamId) continue;
    const a = Math.min(match.prosecutionTeamId, match.defenseTeamId);
    const b = Math.max(match.prosecutionTeamId, match.defenseTeamId);
    set.add(`${a}-${b}`);
  }
  return set;
}

function generateRoundMatches(teamIds, rooms, judgeIds, disallowedPairs) {
  const maxAttempts = 1000;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const shuffled = [...teamIds];
    shuffle(shuffled);
    const matches = [];
    let roomIndex = 0;
    let ok = true;

    for (let i = 0; i < shuffled.length; i += 2) {
      const prosecutionTeamId = shuffled[i];
      const defenseTeamId = shuffled[i + 1] || null;
      if (defenseTeamId) {
        const a = Math.min(prosecutionTeamId, defenseTeamId);
        const b = Math.max(prosecutionTeamId, defenseTeamId);
        if (disallowedPairs.has(`${a}-${b}`)) {
          ok = false;
          break;
        }
      }

      const room =
        rooms.length > 0
          ? rooms[roomIndex % rooms.length].label
          : String(Math.floor(i / 2) + 1);
      const judgeId =
        judgeIds.length > 0 ? judgeIds[roomIndex % judgeIds.length] : null;
      roomIndex += 1;

      matches.push({
        id: state.nextMatchId++,
        courtroom: room,
        prosecutionTeamId,
        defenseTeamId,
        judgeId
      });
    }

    if (ok) {
      return matches;
    }
  }

  return [];
}

function buildRoleMap(matches) {
  const map = new Map();
  for (const match of matches) {
    if (match.prosecutionTeamId) {
      map.set(match.prosecutionTeamId, "P");
    }
    if (match.defenseTeamId) {
      map.set(match.defenseTeamId, "D");
    }
  }
  return map;
}

function clearCompetitionData() {
  state.schools = [];
  state.matches = [];
  state.matchesRound2 = [];
  state.matchesRound3 = [];
  state.round3Confirmed = false;
  state.matchesRound4 = [];
  state.round4Confirmed = false;
  state.scores = [];
  state.results = [];
  state.judges = [];
  state.rooms = [];
  state.nextSchoolId = 1;
  state.nextTeamId = 1;
  state.nextMatchId = 1;
  state.nextJudgeId = 1;
  state.nextRoomId = 1;
}

function broadcastFullState() {
  broadcast("schools", state.schools);
  broadcast("matches", state.matches);
  broadcast("matches_round2", state.matchesRound2);
  broadcast("matches_round3", state.matchesRound3);
  broadcast("matches_round4", state.matchesRound4);
  broadcast("team_totals", getTeamTotals());
  broadcast("scores_reset", []);
  broadcast("results_reset", []);
}

function findMatchById(matchId) {
  const lists = [
    state.matches,
    state.matchesRound2,
    state.matchesRound3 || [],
    state.matchesRound4 || []
  ];
  for (const list of lists) {
    const match = list.find((m) => m.id === matchId);
    if (match) return match;
  }
  return null;
}

function getTeamTotals() {
  const totals = new Map();
  const teams = getTeams();
  for (const team of teams) {
    totals.set(team.id, {
      total: 0,
      wins: 0,
      losses: 0
    });
  }

  for (const result of state.results) {
    const match = findMatchById(result.matchId);
    if (!match) continue;
    if (match.prosecutionTeamId) {
      const current = totals.get(match.prosecutionTeamId) || {
        total: 0,
        wins: 0,
        losses: 0
      };
      current.total += Number(result.prosecutionTotal || 0);
      if (result.winner === "Prosecution") current.wins += 1;
      if (result.winner === "Defense") current.losses += 1;
      totals.set(match.prosecutionTeamId, current);
    }
    if (match.defenseTeamId) {
      const current = totals.get(match.defenseTeamId) || {
        total: 0,
        wins: 0,
        losses: 0
      };
      current.total += Number(result.defenseTotal || 0);
      if (result.winner === "Defense") current.wins += 1;
      if (result.winner === "Prosecution") current.losses += 1;
      totals.set(match.defenseTeamId, current);
    }
  }

  const teamsById = new Map(teams.map((t) => [t.id, t]));
  return [...totals.entries()]
    .map(([teamId, summary]) => {
      const team = teamsById.get(teamId);
      return {
        teamId,
        teamLabel: team ? teamLabel(team) : "Team TBD",
        total: summary.total,
        wins: summary.wins,
        losses: summary.losses
      };
    })
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (a.losses !== b.losses) return a.losses - b.losses;
      return b.total - a.total;
    });
}

function isRoundScored(matches, round) {
  const required = matches.filter((m) => m.defenseTeamId);
  if (required.length === 0) return false;
  return required.every((m) =>
    state.results.some((r) => r.matchId === m.id && r.round === round)
  );
}

function buildPowerRoundMatches(disallowedPairs) {
  const totals = getTeamTotals();
  const orderedTeamIds = totals.map((t) => t.teamId);
  if (orderedTeamIds.length < 2) return [];

  const rooms = [...state.rooms];
  if (rooms.length) shuffle(rooms);
  const judgeIds = state.judges.map((j) => j.id);
  if (judgeIds.length) shuffle(judgeIds);

  const used = new Set();
  const matches = [];
  let roomIndex = 0;

  for (let i = 0; i < orderedTeamIds.length; i += 1) {
    const a = orderedTeamIds[i];
    if (used.has(a)) continue;

    let opponentIndex = -1;
    for (let j = i + 1; j < orderedTeamIds.length; j += 1) {
      const b = orderedTeamIds[j];
      if (used.has(b)) continue;
      const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
      if (!disallowedPairs.has(key)) {
        opponentIndex = j;
        break;
      }
      if (opponentIndex === -1) {
        opponentIndex = j;
      }
    }

    used.add(a);
    const b = opponentIndex >= 0 ? orderedTeamIds[opponentIndex] : null;
    if (b) used.add(b);

    const room =
      rooms.length > 0
        ? rooms[roomIndex % rooms.length].label
        : String(matches.length + 1);
    const judgeId =
      judgeIds.length > 0 ? judgeIds[roomIndex % judgeIds.length] : null;
    roomIndex += 1;

    matches.push({
      id: state.nextMatchId++,
      courtroom: room,
      prosecutionTeamId: a,
      defenseTeamId: b,
      judgeId
    });
  }

  return matches;
}

function maybeGenerateRound3() {
  if ((state.matchesRound3 || []).length > 0) return;
  if (!isRoundScored(state.matches, 1)) return;
  if (!isRoundScored(state.matchesRound2, 2)) return;

  const round3 = buildPowerRoundMatches(
    new Set([
      ...buildPairSet(state.matches),
      ...buildPairSet(state.matchesRound2)
    ])
  );

  if (!round3.length) return;
  state.matchesRound3 = round3;
  broadcast("matches_round3", state.matchesRound3);
}

function maybeGenerateRound4() {
  if ((state.matchesRound4 || []).length > 0) return;
  if (!isRoundScored(state.matchesRound3 || [], 3)) return;

  const round4 = buildPowerRoundMatches(
    new Set([
      ...buildPairSet(state.matches),
      ...buildPairSet(state.matchesRound2),
      ...buildPairSet(state.matchesRound3 || [])
    ])
  );

  if (!round4.length) return;
  state.matchesRound4 = round4;
  broadcast("matches_round4", state.matchesRound4);
}

const sseClients = new Set();

function broadcast(event, payload) {
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    res.write(data);
  }
}

app.get("/", (req, res) => {
  res.render("landing");
});

app.get("/admin", (req, res) => {
  const teams = getTeams();
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const judgesById = new Map(state.judges.map((j) => [j.id, j]));
  res.render("admin", {
    schools: state.schools,
    teams,
    matches: state.matches.map((m) => matchView(m, teamsById, judgesById, 1)),
    judges: state.judges,
    rooms: state.rooms,
    resetSuccess: req.query.reset === "1",
    canConfirmRound3:
      isRoundScored(state.matchesRound2, 2) && (state.matchesRound3 || []).length > 0,
    round3Confirmed: state.round3Confirmed,
    canConfirmRound4:
      isRoundScored(state.matchesRound3 || [], 3) && (state.matchesRound4 || []).length > 0,
    round4Confirmed: state.round4Confirmed
  });
});

app.post("/admin/match", (req, res) => {
  const { courtroom, prosecutionTeamId, defenseTeamId } = req.body;
  const match = {
    id: state.nextMatchId++,
    courtroom: courtroom || "",
    prosecutionTeamId: Number(prosecutionTeamId) || null,
    defenseTeamId: Number(defenseTeamId) || null
  };
  state.matches.push(match);
  broadcast("matches", state.matches);
  res.redirect("/admin?reset=1");
});

app.post("/admin/school", (req, res) => {
  const { schoolName } = req.body;
  const name = (schoolName || "").trim();
  if (name) {
    state.schools.push({
      id: state.nextSchoolId++,
      name,
      teams: []
    });
    broadcast("schools", state.schools);
  }
  res.redirect("/admin");
});

app.post("/admin/team", (req, res) => {
  const { schoolId, teamName } = req.body;
  const name = (teamName || "").trim();
  const school = state.schools.find((s) => s.id === Number(schoolId));
  if (school && name) {
    const existingCodes = new Set(
      state.schools.flatMap((s) => s.teams.map((t) => t.code))
    );
    const code = generateTeamCode(existingCodes);
    school.teams.push({
      id: state.nextTeamId++,
      name,
      code
    });
    broadcast("schools", state.schools);
  }
  res.redirect("/admin");
});

app.post("/admin/team/delete", (req, res) => {
  const teamId = Number(req.body.teamId);
  if (!teamId) {
    res.redirect("/admin");
    return;
  }

  state.schools = state.schools.map((school) => ({
    ...school,
    teams: school.teams.filter((team) => team.id !== teamId)
  }));

  const removedMatchIds = new Set();
  state.matches = state.matches.filter((match) => {
    const removed =
      match.prosecutionTeamId === teamId || match.defenseTeamId === teamId;
    if (removed) {
      removedMatchIds.add(match.id);
    }
    return !removed;
  });

  if (removedMatchIds.size > 0) {
    state.scores = state.scores.filter((score) => !removedMatchIds.has(score.matchId));
  }

  broadcast("schools", state.schools);
  broadcast("matches", state.matches);
  if (removedMatchIds.size > 0) {
    broadcast("scores_reset", []);
  }
  res.redirect("/admin");
});

app.post("/admin/school/delete", (req, res) => {
  const schoolId = Number(req.body.schoolId);
  const school = state.schools.find((s) => s.id === schoolId);
  if (!school) {
    res.redirect("/admin");
    return;
  }

  const removedTeamIds = new Set(school.teams.map((t) => t.id));
  state.schools = state.schools.filter((s) => s.id !== schoolId);

  const removedMatchIds = new Set();
  state.matches = state.matches.filter((match) => {
    const removed =
      removedTeamIds.has(match.prosecutionTeamId) ||
      removedTeamIds.has(match.defenseTeamId);
    if (removed) {
      removedMatchIds.add(match.id);
    }
    return !removed;
  });

  if (removedMatchIds.size > 0) {
    state.scores = state.scores.filter((score) => !removedMatchIds.has(score.matchId));
  }

  broadcast("schools", state.schools);
  broadcast("matches", state.matches);
  if (removedMatchIds.size > 0) {
    broadcast("scores_reset", []);
  }
  res.redirect("/admin");
});

app.post("/admin/room", (req, res) => {
  const { roomNumber } = req.body;
  const value = (roomNumber || "").trim();
  if (value) {
    state.rooms.push({
      id: state.nextRoomId++,
      label: value
    });
  }
  res.redirect("/admin");
});

app.post("/admin/room/delete", (req, res) => {
  const roomId = Number(req.body.roomId);
  if (roomId) {
    state.rooms = state.rooms.filter((room) => room.id !== roomId);
  }
  res.redirect("/admin");
});

app.post("/admin/judge", (req, res) => {
  const { judgeName } = req.body;
  const name = (judgeName || "").trim();
  if (name) {
    addJudge(name);
  }
  res.redirect("/admin");
});

app.post("/admin/judge/delete", (req, res) => {
  const judgeId = Number(req.body.judgeId);
  if (judgeId) {
    state.judges = state.judges.filter((judge) => judge.id !== judgeId);
  }
  res.redirect("/admin");
});

app.post("/admin/autofill", (req, res) => {
  clearCompetitionData();

  const roomLabels = ["101", "102", "103"];
  for (const label of roomLabels) {
    state.rooms.push({
      id: state.nextRoomId++,
      label
    });
  }

  const demoSchools = [
    {
      name: "Phoenix Prep",
      teams: ["Phoenix Prep A", "Phoenix Prep B"]
    },
    {
      name: "Desert Ridge",
      teams: ["Desert Ridge A", "Desert Ridge B"]
    },
    {
      name: "Canyon View",
      teams: ["Canyon View A", "Canyon View B"]
    }
  ];

  for (const schoolData of demoSchools) {
    const school = {
      id: state.nextSchoolId++,
      name: schoolData.name,
      teams: []
    };
    for (const teamName of schoolData.teams) {
      const existingCodes = new Set(
        state.schools.flatMap((s) => s.teams.map((t) => t.code)).concat(
          school.teams.map((t) => t.code)
        )
      );
      school.teams.push({
        id: state.nextTeamId++,
        name: teamName,
        code: generateTeamCode(existingCodes)
      });
    }
    state.schools.push(school);
  }

  const judgeNames = ["Judge Alvarez", "Judge Brooks", "Judge Chen"];
  for (const name of judgeNames) {
    const existingPins = new Set(state.judges.map((j) => j.pin));
    state.judges.push({
      id: state.nextJudgeId++,
      name,
      pin: generateJudgePin(existingPins)
    });
  }

  broadcastFullState();
  res.redirect("/admin");
});

function startCompetition() {
  const teams = getTeams();
  if (teams.length < 2) {
    return false;
  }

  const teamIds = teams.map((t) => t.id);
  const rooms = [...state.rooms];
  if (rooms.length) {
    shuffle(rooms);
  }
  const judgeIds = state.judges.map((j) => j.id);
  if (judgeIds.length) {
    shuffle(judgeIds);
  }
  state.matches = [];
  state.matchesRound2 = [];
  state.matchesRound3 = [];
  state.matchesRound4 = [];
  state.round3Confirmed = false;
  state.round4Confirmed = false;
  state.scores = [];
  state.results = [];

  const round1Matches = generateRoundMatches(teamIds, rooms, judgeIds, new Set());
  state.matches = round1Matches;

  const disallowedPairs = buildPairSet(round1Matches);
  const round2Matches = generateRoundMatches(teamIds, rooms, judgeIds, disallowedPairs);
  const roleMap = buildRoleMap(round1Matches);
  for (const match of round2Matches) {
    if (!match.defenseTeamId) continue;
    const pRole = roleMap.get(match.prosecutionTeamId);
    const dRole = roleMap.get(match.defenseTeamId);
    const shouldSwap =
      (pRole === "P" && dRole === "D") ||
      (pRole === "P" && !dRole) ||
      (!pRole && dRole === "D");
    if (shouldSwap) {
      const temp = match.prosecutionTeamId;
      match.prosecutionTeamId = match.defenseTeamId;
      match.defenseTeamId = temp;
    }
  }
  state.matchesRound2 = round2Matches;

  broadcastFullState();
  return true;
}

app.post("/admin/start", (req, res) => {
  if (!startCompetition()) {
    res.redirect("/admin");
    return;
  }
  res.redirect("/admin");
});

app.post("/admin/restart", (req, res) => {
  clearCompetitionData();
  broadcastFullState();
  res.redirect("/admin");
});

app.post("/admin/confirm-round3", (req, res) => {
  if (isRoundScored(state.matchesRound2, 2) && (state.matchesRound3 || []).length > 0) {
    state.round3Confirmed = true;
  }
  res.redirect("/admin");
});

app.post("/admin/confirm-round4", (req, res) => {
  if (isRoundScored(state.matchesRound3 || [], 3) && (state.matchesRound4 || []).length > 0) {
    state.round4Confirmed = true;
  }
  res.redirect("/admin");
});

app.post("/admin/autofill", (req, res) => {
  const schoolStart = state.schools.length + 1;
  const roomStart = state.rooms.length + 1;
  const judgeStart = state.judges.length + 1;

  for (let i = 0; i < 3; i += 1) {
    const school = addSchool(`Autofill School ${schoolStart + i}`);
    addTeam(school, `Team A`);
    addTeam(school, `Team B`);
  }

  for (let i = 0; i < 3; i += 1) {
    addJudge(`Judge ${judgeStart + i}`);
    addRoom(`Room ${roomStart + i}`);
  }

  broadcast("schools", state.schools);
  broadcast("rooms", state.rooms);
  broadcast("judges", state.judges);
  res.redirect("/admin");
});

app.get("/judges", (req, res) => {
  const pin = String(req.query.pin || "");
  const judge = state.judges.find((j) => j.pin === pin);

  if (!judge) {
    res.render("judges", { judge: null, matches: [], hasJudges: state.judges.length > 0 });
    return;
  }

  const teams = getTeams();
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const judgesById = new Map(state.judges.map((j) => [j.id, j]));
  const assignedRound1 = state.matches.filter((m) => m.judgeId === judge.id);
  const assignedRound2 = state.matchesRound2.filter((m) => m.judgeId === judge.id);
  const assignedRound3 = state.matchesRound3.filter((m) => m.judgeId === judge.id);
  const assignedRound4 = state.matchesRound4.filter((m) => m.judgeId === judge.id);
  const hasRound1Result = assignedRound1.some((m) =>
    state.results.some((r) => r.matchId === m.id && r.round === 1)
  );
  const hasRound2Result = assignedRound2.some((m) =>
    state.results.some((r) => r.matchId === m.id && r.round === 2)
  );
  const hasRound3Result = assignedRound3.some((m) =>
    state.results.some((r) => r.matchId === m.id && r.round === 3)
  );
  let currentRound = 1;
  let assignedMatches = assignedRound1;

  if (hasRound1Result && !hasRound2Result) {
    currentRound = 2;
    assignedMatches = assignedRound2;
  } else if (hasRound1Result && hasRound2Result && !hasRound3Result) {
    currentRound = 3;
    assignedMatches = state.round3Confirmed ? assignedRound3 : [];
  } else if (hasRound1Result && hasRound2Result && hasRound3Result) {
    currentRound = 4;
    assignedMatches = state.round4Confirmed ? assignedRound4 : [];
  }

  res.render("judges", {
    judge,
    matches: assignedMatches.map((m) => matchView(m, teamsById, judgesById, currentRound)),
    hasJudges: true,
    currentRound,
    round3Confirmed: state.round3Confirmed,
    round4Confirmed: state.round4Confirmed
  });
});

app.post("/judges/score", (req, res) => {
  const {
    judgeName,
    matchId,
    judgeId,
    side,
    score,
    notes,
    prosecutionCode,
    defenseCode
  } = req.body;
  const match = state.matches.find((m) => m.id === Number(matchId));
  const judge = state.judges.find((j) => j.id === Number(judgeId));
  if (!match || !judge || match.judgeId !== judge.id) {
    res.redirect("/judges");
    return;
  }
  const entry = {
    judgeName: judgeName || "",
    judgeId: judge.id,
    matchId: Number(matchId) || null,
    side: side || "",
    score: Number(score) || 0,
    notes: notes || "",
    prosecutionCode: (prosecutionCode || "").trim(),
    defenseCode: (defenseCode || "").trim(),
    ts: Date.now()
  };
  state.scores.push(entry);
  broadcast("score", entry);
  res.redirect("/judges");
});

app.post("/judges/submit", (req, res) => {
  const { matchId, judgeId, prosecutionTotal, defenseTotal, round } = req.body;
  const match = state.matches.find((m) => m.id === Number(matchId));
  const matchRound2 = state.matchesRound2.find((m) => m.id === Number(matchId));
  const matchRound3 = state.matchesRound3.find((m) => m.id === Number(matchId));
  const matchRound4 = state.matchesRound4.find((m) => m.id === Number(matchId));
  const targetMatch = match || matchRound2 || matchRound3 || matchRound4;
  const roundNumber = Number(round) || (match ? 1 : matchRound2 ? 2 : matchRound3 ? 3 : 4);
  const judge = state.judges.find((j) => j.id === Number(judgeId));
  const pTotal = Number(prosecutionTotal);
  const dTotal = Number(defenseTotal);
  const teams = getTeams();
  const teamsById = new Map(teams.map((t) => [t.id, t]));

  if (!targetMatch || !judge || targetMatch.judgeId !== judge.id) {
    res.status(400).json({ error: "Invalid match or judge." });
    return;
  }
  if (Number.isNaN(pTotal) || Number.isNaN(dTotal)) {
    res.status(400).json({ error: "Totals must be numbers." });
    return;
  }
  if (pTotal === dTotal) {
    res.status(400).json({ error: "There can’t be any ties." });
    return;
  }

  const winner = pTotal > dTotal ? "Prosecution" : "Defense";
  const prosecutionTeam = teamsById.get(targetMatch.prosecutionTeamId);
  const defenseTeam = teamsById.get(targetMatch.defenseTeamId);
  const existingIndex = state.results.findIndex((r) => r.matchId === targetMatch.id);
  const result = {
    matchId: targetMatch.id,
    round: roundNumber,
    judgeName: judge.name,
    prosecutionTotal: pTotal,
    defenseTotal: dTotal,
    winner,
    prosecutionLabel: prosecutionTeam ? teamLabel(prosecutionTeam) : "",
    defenseLabel: defenseTeam ? teamLabel(defenseTeam) : ""
  };

  if (existingIndex >= 0) {
    state.results[existingIndex] = result;
  } else {
    state.results.push(result);
  }

  maybeGenerateRound3();
  maybeGenerateRound4();
  broadcast("results", result);
  broadcast("team_totals", getTeamTotals());
  res.json({ ok: true });
});

app.get("/teacher", (req, res) => {
  const teams = getTeams();
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const judgesById = new Map(state.judges.map((j) => [j.id, j]));
  res.render("teacher", {
    schools: state.schools,
    matches: state.matches.map((m) => matchView(m, teamsById, judgesById, 1)),
    matchesRound2: (state.matchesRound2 || []).map((m) =>
      matchView(m, teamsById, judgesById, 2)
    ),
    matchesRound3: (state.matchesRound3 || []).map((m) =>
      matchView(m, teamsById, judgesById, 3)
    ),
    matchesRound4: (state.matchesRound4 || []).map((m) =>
      matchView(m, teamsById, judgesById, 4)
    ),
    teamTotals: getTeamTotals(),
    scores: state.scores,
    results: state.results
  });
});

app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  // Send initial state so dashboards can render immediately.
  res.write(`event: schools\ndata: ${JSON.stringify(state.schools)}\n\n`);
  res.write(`event: matches\ndata: ${JSON.stringify(state.matches)}\n\n`);
  res.write(`event: matches_round2\ndata: ${JSON.stringify(state.matchesRound2)}\n\n`);
  res.write(`event: matches_round3\ndata: ${JSON.stringify(state.matchesRound3 || [])}\n\n`);
  res.write(`event: matches_round4\ndata: ${JSON.stringify(state.matchesRound4 || [])}\n\n`);
  res.write(`event: team_totals\ndata: ${JSON.stringify(getTeamTotals())}\n\n`);
  for (const score of state.scores) {
    res.write(`event: score\ndata: ${JSON.stringify(score)}\n\n`);
  }
  for (const result of state.results) {
    res.write(`event: results\ndata: ${JSON.stringify(result)}\n\n`);
  }

  sseClients.add(res);
  req.on("close", () => {
    sseClients.delete(res);
  });
});

function startServer(port, remaining) {
  const server = app.listen(port, () => {
    console.log(`Mock trial server running at http://localhost:${port}`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && remaining > 0) {
      server.close(() => startServer(port + 1, remaining - 1));
      return;
    }
    console.error("Failed to start server:", err.message);
    process.exit(1);
  });
}

startServer(basePort, 9);
