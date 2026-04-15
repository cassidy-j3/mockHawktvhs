const form = document.getElementById("startCompetitionForm");
const button = document.getElementById("startCompetitionButton");
const message = document.getElementById("startCompetitionMessage");
const autofillForm = document.getElementById("autofillForm");
const autofillButton = document.getElementById("autofillButton");
const autofillMessage = document.getElementById("autofillMessage");

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

if (autofillForm && autofillButton && autofillMessage) {
  let armed = false;
  let timer = null;

  autofillForm.addEventListener("submit", (event) => {
    if (!armed) {
      event.preventDefault();
      armed = true;
      autofillButton.textContent = "Click again to autofill";
      autofillMessage.textContent =
        "Click again to create sample schools, teams, judges, and rooms.";

      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        armed = false;
        autofillButton.textContent = "Autofill";
        autofillMessage.textContent = "";
      }, 5000);
    }
  });
}
