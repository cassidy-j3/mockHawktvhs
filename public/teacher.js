const matchDisplay = document.getElementById("matchDisplay");
const matchDisplayRound2 = document.getElementById("matchDisplayRound2");
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
const scores = [];
const results = [];

function renderAll() {
  const teams = getTeams(schools);
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const matchesById = new Map(matches.map((m) => [String(m.id), m]));
  const matchesRound2ById = new Map(matchesRound2.map((m) => [String(m.id), m]));
  renderMatches(matches, teamsById, matchDisplay);
  renderMatches(matchesRound2, teamsById, matchDisplayRound2);
  renderResults(results, matchesById, matchesRound2ById);
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

function renderResults(list, matchesById, matchesRound2ById) {
  const resultsListRound1 = document.getElementById("resultsListRound1");
  const resultsListRound2 = document.getElementById("resultsListRound2");
  if (!resultsListRound1 || !resultsListRound2) return;

  const round1 = list.filter((r) => r.round === 1);
  const round2 = list.filter((r) => r.round === 2);

  function renderInto(target, items) {
    if (!items.length) {
      target.innerHTML = "<p class=\"empty\">No results submitted yet.</p>";
      return;
    }
    const markup = items
      .map((r) => {
        const match =
          matchesById.get(String(r.matchId)) ||
          matchesRound2ById.get(String(r.matchId));
        const label = match
          ? `Room ${match.courtroom || "TBD"}: ${
              match.prosecutionLabel || "Team TBD"
            } vs ${match.defenseLabel || "Team TBD"}`
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
    target.innerHTML = `<ul class="scores">${markup}</ul>`;
  }

  renderInto(resultsListRound1, round1);
  renderInto(resultsListRound2, round2);
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
