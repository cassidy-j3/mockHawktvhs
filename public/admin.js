const form = document.getElementById("startCompetitionForm");
const button = document.getElementById("startCompetitionButton");
const message = document.getElementById("startCompetitionMessage");
const restartForm = document.getElementById("restartCompetitionForm");
const restartButton = document.getElementById("restartCompetitionButton");
const restartMessage = document.getElementById("restartCompetitionMessage");

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
