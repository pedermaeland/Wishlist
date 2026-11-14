const visitorDialog = document.getElementById("visitor-dialog");


if (visitorDialog) {
    const visitorSelect = visitorDialog.querySelector("#velg");
    const visitorForm = visitorDialog.querySelector("form");

    const savedPerson = readSavedPerson();
    if (savedPerson) visitorSelect.value = savedPerson;

    if (savedPerson === null) {
        visitorDialog.showModal();
    } else {
        document.documentElement.classList.add("branch-animation-started");
    }

    function filterWishes(person) {
        const parentWishes = document.querySelectorAll('[data-audience="foreldre"]')
        parentWishes.forEach((wish) => {
            wish.style.display = person === 'foreldre' ? '' : 'none';
        });
        document.dispatchEvent(new Event("visitor-view-changed"));
    }

    filterWishes(savedPerson);
    if (savedPerson !== null) {
        startTextReveal();
    }

    visitorForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const visitorGroup = visitorSelect.value;
        if (!["foreldre", "andre"].includes(visitorGroup)) return;
        try {
            localStorage.setItem("person", visitorGroup);
        } catch {
            // The selected view still works when the browser cannot remember it.
        }
        document.documentElement.classList.add("branch-animation-started");
        filterWishes(visitorGroup);
        visitorDialog.close();
        if (visitorGroup === "foreldre") {
            document.getElementById("foreldre-visitor-dialog")?.showModal();
        } else {
            document.getElementById("andre-visitor-dialog")?.showModal();
        }
        startTextReveal();
    });

    
}

function readSavedPerson() {
    try {
        const person = localStorage.getItem("person");
        return ["foreldre", "andre"].includes(person) ? person : null;
    } catch {
        return null;
    }
}

function changePerson() {
    if (!visitorDialog) return;
    const savedPerson = readSavedPerson();
    if (savedPerson) visitorDialog.querySelector("#velg").value = savedPerson;
    visitorDialog.showModal();
}
