const form = document.getElementById("startCompetitionForm");
const button = document.getElementById("startCompetitionButton");
const message = document.getElementById("startCompetitionMessage");

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
