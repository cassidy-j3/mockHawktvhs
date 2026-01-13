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

function renderAll() {
  const teams = getTeams(schools);
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const matchesById = new Map(matches.map((m) => [String(m.id), m]));
  renderMatches(matches, teamsById);
  renderScores(scores, matchesById, teamsById);
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
