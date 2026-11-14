const SUPABASE_URL = "https://mavrvhoeahazbfaztuei.supabase.co";
const SUPABASE_KEY = "sb_publishable_aMmyBiLJtHdJvGaC3Th_Yg_A1H4mNrG";

// Each block in the HTML supplies its own permanent wish ID.
const reservationControls = [...document.querySelectorAll(
    ".reservation-controls[data-wish-id]"
)].map((element) => ({
    element,
    card: element.closest(".wish, .wish-sub"),
    wishId: element.dataset.wishId,
    name: element.dataset.wishName
        || element.closest("article")?.querySelector("h3, h2")?.textContent.replace("↗", "").trim()
        || document.querySelector("h1")?.textContent.trim()
        || "denne gaven",
    status: element.querySelector(".reservation-status"),
    button: element.querySelector(".reservation-button"),
})).filter((control) => control.status && control.button);

reservationControls.forEach((control) => {
    const help = document.createElement("p");
    help.className = "reservation-help";
    help.hidden = true;
    control.element.append(help);
    control.help = help;
});

function rememberReservationLink(element) {
    return {
        element,
        href: element.getAttribute("href"),
        tabIndex: element.getAttribute("tabindex"),
    };
}

// Remember original links so canceling a reservation restores them exactly.
const reservationCards = [...new Set(reservationControls.map((control) => control.card))]
    .filter(Boolean)
    .map((card) => ({
        element: card,
        controls: reservationControls.filter((control) => control.card === card),
        links: [...card.querySelectorAll("a.wish-link, a.wish-product-link, a.skittfiske-link")]
            .map(rememberReservationLink).filter((link) => link.href !== null),
    }));

// Information pages stay readable; their shop actions still respect reservations.
const reservationShopLinks = [...document.querySelectorAll("a[data-wish-shop]")]
    .map((element) => ({
        ...rememberReservationLink(element),
        wishId: element.dataset.wishShop,
    })).filter((link) => link.href !== null);

let cancellationToken;
let wishStatuses = new Map();
let hasCheckedReservations = false;
let loadingReservations = false;
let savingReservation = false;
let reservationLoadFailed = false;
let reservationStorageFailed = false;

function setReservationLinkDisabled(link, disabled) {
    link.element.classList.toggle("reservation-link-disabled", disabled);
    if (disabled) {
        link.element.removeAttribute("href");
        link.element.setAttribute("aria-disabled", "true");
        link.element.setAttribute("tabindex", "-1");
    } else {
        link.element.setAttribute("href", link.href);
        link.element.removeAttribute("aria-disabled");
        if (link.tabIndex === null) link.element.removeAttribute("tabindex");
        else link.element.setAttribute("tabindex", link.tabIndex);
    }
}

function setReservationText(element, text) {
    // Rechecking on tab focus should not announce every unchanged status again.
    if (element.textContent !== text) element.textContent = text;
}

async function callSupabase(functionName, parameters = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/rpc/${functionName}`,
            {
                method: "POST",
                headers: {
                    apikey: SUPABASE_KEY,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(parameters),
                signal: controller.signal,
            }
        );

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || `Request failed: ${response.status}`);
        }
        return data;
    } finally {
        clearTimeout(timeout);
    }
}

function renderReservations() {
    reservationControls.forEach((control) => {
        const wish = wishStatuses.get(control.wishId);
        let status;
        let label;
        let disabled = false;
        let help = "";

        if (savingReservation || (loadingReservations && !hasCheckedReservations)) {
            status = savingReservation ? "Lagrer…" : "Sjekker reservasjon…";
            label = "Vent litt…";
            disabled = true;
        } else if (reservationLoadFailed) {
            status = reservationStorageFailed
                ? "Nettleseren kan ikke huske reservasjonen."
                : "Kunne ikke sjekke om gaven er ledig.";
            label = "Prøv igjen";
            help = reservationStorageFailed
                ? "Tillat lagring for siden og prøv igjen. Spør Peder hvis du trenger hjelp."
                : "Prøv igjen før du kjøper. Spør Peder hvis det fortsatt ikke virker.";
        } else if (!wish) {
            // Unknown IDs must never appear available for purchase.
            status = "Reservasjon er ikke tilgjengelig ennå.";
            label = "Ikke tilgjengelig";
            disabled = true;
            help = "Spør Peder før du kjøper denne gaven.";
        } else if (wish.reserved_by_you) {
            status = "Reservert av deg";
            label = "Angre reservasjon";
            help = "Behold reservasjonen etter kjøpet.";
        } else if (wish.is_reserved) {
            status = "Reservert av noen andre";
            label = "Reservert";
            disabled = true;
        } else {
            status = "Ledig";
            label = "Reserver";
        }

        setReservationText(control.status, status);
        setReservationText(control.help, help);
        control.help.hidden = help === "";
        control.element.classList.toggle("has-long-status", status !== "Ledig");
        control.element.classList.toggle("is-reserved", !reservationLoadFailed
            && (wish?.is_reserved === true || wish?.reserved_by_you === true));
        setReservationText(control.button, label);
        control.button.disabled = disabled;
        control.button.setAttribute("aria-label", `${label}: ${control.name}`);
        control.button.classList.toggle("is-reserved-by-you",
            wish?.reserved_by_you === true && !reservationLoadFailed);
    });

    reservationCards.forEach((card) => {
        // Keep shop links for your own reservations, including shared size-selection links.
        const reservedByOthers = card.controls.every((control) => {
            const wish = wishStatuses.get(control.wishId);
            return wish?.is_reserved === true && wish.reserved_by_you !== true;
        });
        const isGo60 = card.controls.some((control) => control.wishId === "go60");
        card.element.classList.toggle("is-reserved-by-others", reservedByOthers);
        const canShop = hasCheckedReservations && !reservationLoadFailed
            && card.controls.some((control) => {
                const wish = wishStatuses.get(control.wishId);
                return wish && (!wish.is_reserved || wish.reserved_by_you);
            });

        card.links.forEach((link) => {
            const externalShop = /^https?:\/\//i.test(link.href);
            setReservationLinkDisabled(link, externalShop
                ? !canShop : reservedByOthers && !isGo60);
        });
    });

    reservationShopLinks.forEach((link) => {
        const wish = wishStatuses.get(link.wishId);
        const disabled = !hasCheckedReservations || reservationLoadFailed || !wish
            || (wish.is_reserved && !wish.reserved_by_you);
        setReservationLinkDisabled(link, disabled);
    });
}

function createCancellationToken() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(
        bytes,
        byte => byte.toString(16).padStart(2, "0")
    ).join("");

    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20),
    ].join("-");
}

function getCancellationToken() {
    reservationStorageFailed = false;
    try {
        let token = localStorage.getItem("wishlist-cancellation-token");
        if (!token) {
            token = createCancellationToken();
            localStorage.setItem("wishlist-cancellation-token", token);
        }
        return token;
    } catch (error) {
        reservationStorageFailed = true;
        throw error;
    }
}

async function refreshReservations() {
    if (loadingReservations || savingReservation) return;
    loadingReservations = true;
    renderReservations();

    try {
        cancellationToken = getCancellationToken();
        const wishes = await callSupabase("get_wish_statuses", {
            p_cancel_token: cancellationToken,
        });
        if (!Array.isArray(wishes) || wishes.some((wish) =>
            typeof wish.wish_id !== "string"
            || typeof wish.is_reserved !== "boolean"
            || typeof wish.reserved_by_you !== "boolean")) {
            throw new Error("Unexpected reservation status response.");
        }
        wishStatuses = new Map(wishes.map((wish) => [wish.wish_id, wish]));
        hasCheckedReservations = true;
        reservationLoadFailed = false;
    } catch (error) {
        console.error(error);
        reservationLoadFailed = true;
    } finally {
        loadingReservations = false;
        renderReservations();
    }
}

async function changeReservation(control) {
    if (loadingReservations || savingReservation) return;
    if (reservationLoadFailed) {
        await refreshReservations();
        return;
    }

    const wish = wishStatuses.get(control.wishId);
    if (!wish || (wish.is_reserved && !wish.reserved_by_you)) return;

    const canceling = wish.reserved_by_you;
    const confirmation = canceling
        ? `Vil du fjerne reservasjonen av ${control.name}? Gaven blir da tilgjengelig for andre igjen. Behold reservasjonen hvis du allerede har kjøpt gaven.`
        : `Vil du reservere ${control.name}? Dette kjøper ikke gaven. Kjøp den i nettbutikken etterpå, og behold reservasjonen etter kjøpet.`;
    if (!window.confirm(confirmation)) return;

    savingReservation = true;
    renderReservations();

    try {
        await callSupabase(
            canceling ? "cancel_reservation" : "reserve_wish",
            {
                p_wish_id: control.wishId,
                p_cancel_token: cancellationToken,
            }
        );
    } catch (error) {
        // Keep the existing token: the server may have saved before the connection failed.
        console.error(error);
        reservationLoadFailed = true;
        savingReservation = false;
        renderReservations();
        reservationControls.filter((item) => item.wishId === control.wishId)
            .forEach((item) => {
                setReservationText(item.status, "Kunne ikke bekrefte endringen. Trykk Prøv igjen.");
            });
        return;
    }

    savingReservation = false;
    await refreshReservations();
}

if (reservationControls.length > 0) {
    reservationControls.forEach((control) => {
        control.button.addEventListener("click", () => changeReservation(control));
    });

    // Refresh when returning from a shop or another tab; the server still decides who wins.
    window.addEventListener("focus", refreshReservations);
    window.addEventListener("pageshow", refreshReservations);
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") refreshReservations();
    });
    refreshReservations();
}
