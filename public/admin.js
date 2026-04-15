const form = document.getElementById("startCompetitionForm");
const button = document.getElementById("startCompetitionButton");
const message = document.getElementById("startCompetitionMessage");
const autofillForm = document.getElementById("autofillForm");
const autofillButton = document.getElementById("autofillButton");
const autofillMessage = document.getElementById("autofillMessage");
const restartForm = document.getElementById("restartCompetitionForm");
const restartButton = document.getElementById("restartCompetitionButton");
const restartMessage = document.getElementById("restartCompetitionMessage");
const confirmRound3Form = document.getElementById("confirmRound3Form");
const confirmRound3Button = document.getElementById("confirmRound3Button");
const confirmRound3Message = document.getElementById("confirmRound3Message");

if (autofillForm && autofillButton && autofillMessage) {
  let armed = false;
  let timer = null;

  autofillForm.addEventListener("submit", (event) => {
    if (!armed) {
      event.preventDefault();
      armed = true;
      autofillButton.textContent = "Confirm Autofill";
      autofillMessage.textContent = "Click again to replace current setup with demo data.";

      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        armed = false;
        autofillButton.textContent = "Autofill Demo Setup";
        autofillMessage.textContent = "";
      }, 5000);
    }
  });
}

if (form && button && message) {
  let armed = false;
  let timer = null;

  form.addEventListener("submit", (event) => {
    if (!armed) {
      event.preventDefault();
      armed = true;
      button.textContent = "Confirm Start";
      message.textContent = "Click again to start and generate pairings.";

      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        armed = false;
        button.textContent = "Start Competition";
        message.textContent = "";
      }, 5000);
    }
  });
}

if (restartForm && restartButton && restartMessage) {
  let armed = false;
  let timer = null;

  restartForm.addEventListener("submit", (event) => {
    if (!armed) {
      event.preventDefault();
      armed = true;
      restartButton.textContent = "Confirm Restart";
      restartMessage.textContent = "Click again to restart and reshuffle pairings.";

      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        armed = false;
        restartButton.textContent = "Restart Competition";
        restartMessage.textContent = "";
      }, 5000);
    }
  });
}

if (confirmRound3Form && confirmRound3Button && confirmRound3Message) {
  let armed = false;
  let timer = null;

  confirmRound3Form.addEventListener("submit", (event) => {
    if (!armed) {
      event.preventDefault();
      armed = true;
      confirmRound3Button.textContent = "Confirm Round 3";
      confirmRound3Message.textContent =
        "Click again to unlock round 3 scoring for judges.";

      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        armed = false;
        confirmRound3Button.textContent = "Confirm Round 3 Pairings";
        confirmRound3Message.textContent = "";
      }, 5000);
    }
  });
}
