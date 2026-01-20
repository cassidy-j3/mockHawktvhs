import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// In-memory state for now; swap with SQLite later.
const state = {
  schools: [],
  matches: [],
  scores: [],
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

function matchView(match, teamsById, judgesById) {
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
    judgeName: judge ? judge.name : "Unassigned"
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

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
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
    matches: state.matches.map((m) => matchView(m, teamsById, judgesById)),
    judges: state.judges,
    rooms: state.rooms
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
  res.redirect("/admin");
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
    const existingPins = new Set(state.judges.map((j) => j.pin));
    const pin = generateJudgePin(existingPins);
    state.judges.push({
      id: state.nextJudgeId++,
      name,
      pin
    });
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

app.post("/admin/start", (req, res) => {
  const teams = getTeams();
  if (teams.length < 2) {
    res.redirect("/admin");
    return;
  }

  const teamIds = teams.map((t) => t.id);
  shuffle(teamIds);

  state.matches = [];
  state.scores = [];
  const rooms = [...state.rooms];
  if (rooms.length) {
    shuffle(rooms);
  }
  const judgeIds = state.judges.map((j) => j.id);
  if (judgeIds.length) {
    shuffle(judgeIds);
  }
  let roomIndex = 0;
  for (let i = 0; i < teamIds.length; i += 2) {
    const prosecutionTeamId = teamIds[i];
    const defenseTeamId = teamIds[i + 1] || null;
    const room =
      rooms.length > 0
        ? rooms[roomIndex % rooms.length].label
        : String(Math.floor(i / 2) + 1);
    const judgeId =
      judgeIds.length > 0 ? judgeIds[roomIndex % judgeIds.length] : null;
    roomIndex += 1;
    state.matches.push({
      id: state.nextMatchId++,
      courtroom: room,
      prosecutionTeamId,
      defenseTeamId,
      judgeId
    });
  }

  broadcast("matches", state.matches);
  broadcast("scores_reset", []);
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
  const assignedMatches = state.matches.filter((m) => m.judgeId === judge.id);
  res.render("judges", {
    judge,
    matches: assignedMatches.map((m) => matchView(m, teamsById, judgesById)),
    hasJudges: true
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

app.get("/teacher", (req, res) => {
  const teams = getTeams();
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const judgesById = new Map(state.judges.map((j) => [j.id, j]));
  res.render("teacher", {
    schools: state.schools,
    matches: state.matches.map((m) => matchView(m, teamsById, judgesById)),
    scores: state.scores
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
  for (const score of state.scores) {
    res.write(`event: score\ndata: ${JSON.stringify(score)}\n\n`);
  }

  sseClients.add(res);
  req.on("close", () => {
    sseClients.delete(res);
  });
});

app.listen(port, () => {
  console.log(`Mock trial server running at http://localhost:${port}`);
});
