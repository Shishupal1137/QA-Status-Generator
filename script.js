function updateReport() {

  const dateInput = document.getElementById("date").value;
  const tasks = document.getElementById("tasks").value;

  // Format date
  let formattedDate = "";
  if (dateInput) {
    const date = new Date(dateInput);
    formattedDate = date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }

  // Get selected members
  const checkboxes = document.querySelectorAll("input[name='member']:checked");
  let names = [];

  checkboxes.forEach(cb => {
    names.push(cb.value);
  });

  const nameList = names.join(", ");

  // Generate output
  const output = `Hi Jenny,

Below are the tasks performed by the Orion India QA team on ${formattedDate},

${nameList}:

${tasks}

Thanks,
Mohit`;

  document.getElementById("output").innerText = output;
}


// Copy function
function copyText() {
  const text = document.getElementById("output").innerText;

  if (!text.trim()) {
    alert("Nothing to copy!");
    return;
  }

  navigator.clipboard.writeText(text);
  alert("Copied successfully!");
}