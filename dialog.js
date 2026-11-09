const visitorDialog = document.getElementById("visitor-dialog");


if (visitorDialog) {
    const visitorSelect = visitorDialog.querySelector("#velg");
    const visitorForm = visitorDialog.querySelector("form");

    const savedPerson = localStorage.getItem("person");
    console.log(savedPerson);

    if (savedPerson === null) {
        visitorDialog.showModal();
    } else {
        document.documentElement.classList.add("branch-animation-complete");
    }

    visitorForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const visitorGroup = visitorSelect.value;
        console.log(visitorGroup);
        localStorage.setItem("person", visitorGroup)
        document.documentElement.classList.add("branch-animation-started");
        visitorDialog.close();
    });
}