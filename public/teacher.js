const matchDisplay = document.getElementById("matchDisplay");
const matchDisplayRound2 = document.getElementById("matchDisplayRound2");
const matchDisplayRound3 = document.getElementById("matchDisplayRound3");
const matchDisplayRound4 = document.getElementById("matchDisplayRound4");
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

function renderMatches(list, teamsById, target) {
  if (!target) return;
  if (!list.length) {
    target.innerHTML = '<p class="empty">No matches configured yet.</p>';
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

  target.innerHTML = `<ul class="match-list">${items}</ul>`;
}

let schools = [];
let matches = [];
let matchesRound2 = [];
let matchesRound3 = [];
let matchesRound4 = [];
let teamTotals = [];
const scores = [];
const results = [];

function renderAll() {
  const teams = getTeams(schools);
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const matchesById = new Map(matches.map((m) => [String(m.id), m]));
  const matchesRound2ById = new Map(matchesRound2.map((m) => [String(m.id), m]));
  const matchesRound3ById = new Map(matchesRound3.map((m) => [String(m.id), m]));
  const matchesRound4ById = new Map(matchesRound4.map((m) => [String(m.id), m]));
  renderMatches(matches, teamsById, matchDisplay);
  renderMatches(matchesRound2, teamsById, matchDisplayRound2);
  renderMatches(matchesRound3, teamsById, matchDisplayRound3);
  renderMatches(matchesRound4, teamsById, matchDisplayRound4);
  renderTeamTotals(teamTotals);
  renderResults(results, matchesById, matchesRound2ById, matchesRound3ById, matchesRound4ById);
}

source.addEventListener("schools", (event) => {
  schools = JSON.parse(event.data);
  renderAll();
});

source.addEventListener("matches", (event) => {
  matches = JSON.parse(event.data);
  renderAll();
});

source.addEventListener("matches_round2", (event) => {
  matchesRound2 = JSON.parse(event.data);
  renderAll();
});

source.addEventListener("matches_round3", (event) => {
  matchesRound3 = JSON.parse(event.data);
  renderAll();
});

source.addEventListener("matches_round4", (event) => {
  matchesRound4 = JSON.parse(event.data);
  renderAll();
});

source.addEventListener("team_totals", (event) => {
  teamTotals = JSON.parse(event.data);
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

source.addEventListener("results_reset", () => {
  results.length = 0;
  renderAll();
});

function renderResults(list, matchesById, matchesRound2ById, matchesRound3ById, matchesRound4ById) {
  const resultsListRound1 = document.getElementById("resultsListRound1");
  const resultsListRound2 = document.getElementById("resultsListRound2");
  const resultsListRound3 = document.getElementById("resultsListRound3");
  const resultsListRound4 = document.getElementById("resultsListRound4");
  if (!resultsListRound1 || !resultsListRound2 || !resultsListRound3 || !resultsListRound4) return;

  const round1 = list.filter((r) => r.round === 1);
  const round2 = list.filter((r) => r.round === 2);
  const round3 = list.filter((r) => r.round === 3);
  const round4 = list.filter((r) => r.round === 4);

  function renderInto(target, items) {
    if (!items.length) {
      target.innerHTML = "<p class=\"empty\">No results submitted yet.</p>";
      return;
    }
    const markup = items
      .map((r) => {
        const match =
          matchesById.get(String(r.matchId)) ||
          matchesRound2ById.get(String(r.matchId)) ||
          matchesRound3ById.get(String(r.matchId)) ||
          matchesRound4ById.get(String(r.matchId));
        const label = match
          ? `Room ${match.courtroom || "TBD"}: ${
              match.prosecutionLabel || r.prosecutionLabel || "Team TBD"
            } vs ${match.defenseLabel || r.defenseLabel || "Team TBD"}`
          : `${r.prosecutionLabel || "Team TBD"} vs ${
              r.defenseLabel || "Team TBD"
            }`;
        return `
        <li>
          <strong>${label}</strong>
          <span>Judge: ${r.judgeName}</span>
          <span>Prosecution: ${r.prosecutionTotal} | Defense: ${r.defenseTotal}</span>
          <span class="note">Winner: ${r.winner}</span>
        </li>`;
      })
      .join("");
    target.innerHTML = `<ul class="scores">${markup}</ul>`;
  }

  renderInto(resultsListRound1, round1);
  renderInto(resultsListRound2, round2);
  renderInto(resultsListRound3, round3);
  renderInto(resultsListRound4, round4);
}

function renderTeamTotals(list) {
  const totalsList = document.getElementById("teamTotalsList");
  if (!totalsList) return;
  if (!list.length) {
    totalsList.innerHTML = '<p class="empty">No team totals yet.</p>';
    return;
  }
  const items = list
    .map(
      (t) => `
        <li>
          <strong>${t.teamLabel}</strong>
          <span>Record: ${t.wins}-${t.losses}</span>
          <span>Total: ${t.total}</span>
        </li>`
    )
    .join("");
  totalsList.innerHTML = `<ul class="scores">${items}</ul>`;
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
