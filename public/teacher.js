const matchDisplay = document.getElementById("matchDisplay");
const scoresList = document.getElementById("scoresList");
const source = new EventSource("/events");

function getTeams(schools) {
  return schools.flatMap((school) =>
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

function matchLabel(match, teamsById) {
  const prosecution = teamsById.get(match.prosecutionTeamId);
  const defense = teamsById.get(match.defenseTeamId);
  return `Courtroom ${match.courtroom || "TBD"}: ${teamLabel(prosecution)} vs ${teamLabel(defense)}`;
}

function renderMatches(list, teamsById) {
  if (!list.length) {
    matchDisplay.innerHTML = '<p class="empty">No matches configured yet.</p>';
    return;
  }

  const items = list
    .map(
      (m) => `
        <li class="match-item">
          <strong>${matchLabel(m, teamsById)}</strong>
        </li>`
    )
    .join("");

  matchDisplay.innerHTML = `<ul class="match-list">${items}</ul>`;
}

function renderScores(scores, matchesById, teamsById) {
  if (!scores.length) {
    scoresList.innerHTML = '<p class="empty">No scores submitted yet.</p>';
    return;
  }

  const items = scores
    .map((s) => {
      const match = matchesById.get(String(s.matchId));
      const label = match ? matchLabel(match, teamsById) : "Match TBD";
      return `
        <li>
          <strong>${s.judgeName || "Judge"}</strong> - ${label}
          <span>${s.side} - ${s.score}</span>
          <span class="note">${s.notes || ""}</span>
        </li>`;
    })
    .join("");

  scoresList.innerHTML = `<ul class="scores">${items}</ul>`;
}

let schools = [];
let matches = [];
const scores = [];
const results = [];

function renderAll() {
  const teams = getTeams(schools);
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const matchesById = new Map(matches.map((m) => [String(m.id), m]));
  renderMatches(matches, teamsById);
  renderScores(scores, matchesById, teamsById);
  renderResults(results, matchesById);
}

source.addEventListener("schools", (event) => {
  schools = JSON.parse(event.data);
  renderAll();
});

source.addEventListener("matches", (event) => {
  matches = JSON.parse(event.data);
  renderAll();
});

source.addEventListener("score", (event) => {
  scores.push(JSON.parse(event.data));
  renderAll();
});

source.addEventListener("scores_reset", () => {
  scores.length = 0;
  renderAll();
});

function renderResults(list, matchesById) {
  const resultsList = document.getElementById("resultsList");
  if (!resultsList) return;

  if (!list.length) {
    resultsList.innerHTML = '<p class="empty">No results submitted yet.</p>';
    return;
  }

  const items = list
    .map((r) => {
      const match = matchesById.get(String(r.matchId));
      const label = match
        ? `Room ${match.courtroom || "TBD"}: ${match.prosecutionLabel} vs ${match.defenseLabel}`
        : "Match TBD";
      return `
        <li>
          <strong>${label}</strong>
          <span>Judge: ${r.judgeName}</span>
          <span>Prosecution: ${r.prosecutionTotal} | Defense: ${r.defenseTotal}</span>
          <span class="note">Winner: ${r.winner}</span>
        </li>`;
    })
    .join("");

  resultsList.innerHTML = `<ul class="scores">${items}</ul>`;
}

source.addEventListener("results", (event) => {
  const result = JSON.parse(event.data);
  const index = results.findIndex((r) => r.matchId === result.matchId);
  if (index >= 0) {
    results[index] = result;
  } else {
    results.push(result);
  }
  renderAll();
});
