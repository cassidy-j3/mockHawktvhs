const scoreSections = document.querySelectorAll("[data-score-section]");
const scoreGrid = document.querySelector(".score-grid");
const judgeId = scoreGrid?.dataset.judgeId || "";
const matchId = scoreGrid?.dataset.matchId || "";
const round = scoreGrid?.dataset.round || "1";

function clampInput(input) {
  if (input.value === "") return;
  const value = Number(input.value);
  if (Number.isNaN(value)) return;
  if (value < 1) input.value = "1";
  if (value > 10) input.value = "10";
}

function updateSubtotal(section) {
  const inputs = section.querySelectorAll(".score-input");
  let total = 0;
  for (const input of inputs) {
    const value = Number(input.value);
    if (!Number.isNaN(value)) {
      total += value;
    }
  }
  const totalEl = section.querySelector("[data-score-total]");
  if (totalEl) totalEl.textContent = String(total);
}

function getSubtotal(section) {
  const totalEl = section.querySelector("[data-score-total]");
  if (!totalEl) return 0;
  const value = Number(totalEl.textContent);
  return Number.isNaN(value) ? 0 : value;
}

for (const section of scoreSections) {
  const inputs = section.querySelectorAll(".score-input");
  for (const input of inputs) {
    input.addEventListener("input", () => {
      clampInput(input);
      updateSubtotal(section);
    });
  }
  updateSubtotal(section);
}

const submitButton = document.getElementById("submitScoresButton");
const submitMessage = document.getElementById("submitScoresMessage");
const autofillButton = document.getElementById("autofillScoresButton");
const autofillMessage = document.getElementById("autofillScoresMessage");

if (autofillButton && autofillMessage && scoreSections.length === 2) {
  const [prosecutionSection, defenseSection] = scoreSections;

  autofillButton.addEventListener("click", () => {
    const prosecutionInputs = prosecutionSection.querySelectorAll(".score-input");
    const defenseInputs = defenseSection.querySelectorAll(".score-input");
    let attempts = 0;

    do {
      for (const input of prosecutionInputs) {
        input.value = String(Math.floor(Math.random() * 10) + 1);
      }
      for (const input of defenseInputs) {
        input.value = String(Math.floor(Math.random() * 10) + 1);
      }
      updateSubtotal(prosecutionSection);
      updateSubtotal(defenseSection);
      attempts += 1;
    } while (
      getSubtotal(prosecutionSection) === getSubtotal(defenseSection) &&
      attempts < 100
    );

    if (getSubtotal(prosecutionSection) === getSubtotal(defenseSection)) {
      autofillMessage.textContent = "Autofill could not avoid a tie. Try again.";
      return;
    }

    autofillMessage.textContent = "Scores autofilled with no tie.";
  });
}

if (submitButton && submitMessage && scoreSections.length === 2) {
  let armed = false;
  let timer = null;

  const [prosecutionSection, defenseSection] = scoreSections;

  submitButton.addEventListener("click", () => {
    if (!matchId) {
      submitMessage.textContent = "No match assigned for this round.";
      return;
    }
    const allInputs = document.querySelectorAll(".score-input");
    for (const input of allInputs) {
      if (input.value === "") {
        submitMessage.textContent = "Please fill out all score fields.";
        armed = false;
        submitButton.textContent = "Submit Scores";
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        return;
      }
    }

    const prosecutionTotal = getSubtotal(prosecutionSection);
    const defenseTotal = getSubtotal(defenseSection);

    if (prosecutionTotal === defenseTotal) {
      submitMessage.textContent = "There can’t be any ties.";
      armed = false;
      submitButton.textContent = "Submit Scores";
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      return;
    }

    if (!armed) {
      armed = true;
      submitButton.textContent = "Confirm Submit";
      submitMessage.textContent = "Click again to confirm your scores.";
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        armed = false;
        submitButton.textContent = "Submit Scores";
        submitMessage.textContent = "";
      }, 5000);
      return;
    }

    fetch("/judges/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId,
        judgeId,
        prosecutionTotal,
        defenseTotal,
        round
      })
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Unable to submit scores.");
        }
        return res.json();
      })
      .then(() => {
        armed = false;
        submitButton.textContent = "Submit Scores";
        submitMessage.textContent = "Scores submitted.";
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        window.location.href = "/judges";
      })
      .catch((err) => {
        submitMessage.textContent = err.message;
        armed = false;
        submitButton.textContent = "Submit Scores";
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      });
  });
}
