// CAROUSEL SETTINGS — edit here, save, then refresh the browser.
const carouselSettings = {
    sideScale: 0.8,        // 0.88 = 88% size at the outer edges. 1 = no shrinking.
    sideOpacity: 0.65,      // 0.65 = 65% opacity at the outer edges. 1 = no fading.
    effectRange: 2,         // Card spacings from center to full effect. Higher = gentler.
    smoothingMs: 120,       // Size/fade smoothing in milliseconds. 0 = follows instantly.
    navigationMs: 750,     // Arrow/dot travel time. Higher = slower, on every device.
    navigationEasing: "cubic-bezier(0.22, 0.8, 0.3, 1.03)", // Small overshoot, then settle.
    easing: "cubic-bezier(0.22, 0.8, 0.3, 1.02)", // Softer takeoff and a long, gentle settle.
    cardWidthRem: 13,      // Mobile card width. 13rem is normally 208px.
    gapRem: 0.5,          // Space between cards. Keep >= 0 to avoid overlap.
    snap: "proximity",     // "proximity" = gentle, "mandatory" = always center, "none" = free.
    showControls: true,    // true = show arrows/dots. false = swipe only.
};

const wishGrids = document.querySelectorAll(".wish-grid, .wish-misc");

function updateWishDelays(grid) {
    grid.querySelectorAll(".wish, .wish-sub").forEach((wish, index) => {
        wish.style.setProperty("--stagger-index", index);
    });
}

const wishObserver = new MutationObserver(() => {
    wishGrids.forEach(updateWishDelays);
});

wishGrids.forEach((grid) => {
    updateWishDelays(grid);
    wishObserver.observe(grid, { childList: true, subtree: true });
});



const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.15 });

document.querySelectorAll(".wish, .wish-sub").forEach((card) => {
    revealObserver.observe(card);
});

// Native scrolling drives a flat stack of smaller, faded side cards.
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// CSS curves describe x (time) and y (progress). Find y for the current time.
function easeCarousel(time, curve = carouselSettings.easing) {
    const values = curve.match(/^cubic-bezier\(([^)]+)\)$/)?.[1]
        .split(",").map(Number);
    if (!values || values.length !== 4 || values.some(value => !Number.isFinite(value))) {
        return time;
    }
    const [x1, y1, x2, y2] = values;
    const point = (t, a, b) => 3 * (1 - t) ** 2 * t * a
        + 3 * (1 - t) * t ** 2 * b + t ** 3;
    let low = 0;
    let high = 1;
    for (let step = 0; step < 18; step++) {
        const middle = (low + high) / 2;
        if (point(middle, x1, x2) < time) low = middle;
        else high = middle;
    }
    return point((low + high) / 2, y1, y2);
}

wishGrids.forEach((row) => {
    const cards = [...row.querySelectorAll(":scope > .wish, :scope > .wish-sub")];
    if (cards.length < 2) return;
    const hoverDevice = window.matchMedia("(hover: hover) and (pointer: fine)");
    const updateHover = () => cards.forEach(card =>
        card.classList.toggle("can-hover", hoverDevice.matches));
    updateHover();
    hoverDevice.addEventListener("change", updateHover);
    if (cards.length < 2) return;
    row.style.setProperty("--carousel-card-width", `${carouselSettings.cardWidthRem}rem`);
    row.style.setProperty("--carousel-gap", `${carouselSettings.gapRem}rem`);
    row.style.setProperty("--carousel-smoothing", `${carouselSettings.smoothingMs}ms`);
    row.style.setProperty("--carousel-easing", carouselSettings.easing);
    row.style.setProperty("--carousel-snap", carouselSettings.snap === "none"
        ? "none" : `x ${carouselSettings.snap}`);
    // Snap to a stable slot, independent of the card's visual size.
    const slots = cards.map((card) => {
        const slot = document.createElement("div");
        slot.className = "carousel-item";
        card.before(slot);
        slot.append(card);
        return slot;
    });
    let framePending = false;
    let activeIndex = 0;
    let navigationFrame = null;
    let navigationIndex = null;
    let savedSnap = "";

    function stopNavigation() {
        if (navigationFrame === null) return;
        cancelAnimationFrame(navigationFrame);
        navigationFrame = null;
        navigationIndex = null;
        row.style.scrollSnapType = savedSnap;
        row.style.removeProperty("--navigation-overflow");
    }

    const controls = document.createElement("div");
    controls.className = "carousel-controls";
    controls.hidden = true;
    const previous = document.createElement("button");
    previous.type = "button";
    previous.textContent = "←";
    previous.setAttribute("aria-label", "Forrige ønske");
    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "→";
    next.setAttribute("aria-label", "Neste ønske");
    const dots = cards.map((card, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "carousel-dot";
        const name = card.querySelector("img")?.alt
            || card.querySelector("h3")?.textContent.replace("↗", "").trim()
            || `ønske ${index + 1}`;
        button.setAttribute("aria-label", `Vis ${name}`);
        button.addEventListener("click", () => goToCard(index));
        return button;
    });
    controls.append(previous, ...dots, next);
    row.after(controls);
    previous.addEventListener("click", () => goToCard((navigationIndex ?? activeIndex) - 1));
    next.addEventListener("click", () => goToCard((navigationIndex ?? activeIndex) + 1));

    function goToCard(index) {
        stopNavigation();
        navigationIndex = Math.max(0, Math.min(slots.length - 1, index));
        const target = slots[navigationIndex];
        const destination = Math.max(0, Math.min(row.scrollWidth - row.clientWidth,
            target.offsetLeft + target.offsetWidth / 2 - row.clientWidth / 2));
        const start = row.scrollLeft;
        const duration = reducedMotion.matches ? 0 : carouselSettings.navigationMs;
        if (duration <= 0) {
            row.scrollTo({ left: destination, behavior: "instant" });
            navigationIndex = null;
            return;
        }
        // Snapping must wait until the custom movement reaches its target.
        savedSnap = row.style.scrollSnapType;
        row.style.scrollSnapType = "none";
        const started = performance.now();
        function animate(now) {
            const time = Math.min(1, (now - started) / duration);
            const position = start + (destination - start)
                * easeCarousel(time, carouselSettings.navigationEasing);
            const bounded = Math.max(0, Math.min(row.scrollWidth - row.clientWidth, position));
            // At either end, move the cards visually beyond the scroll boundary.
            row.style.setProperty("--navigation-overflow", `${bounded - position}px`);
            row.scrollTo({
                left: bounded,
                behavior: "instant",
            });
            if (time < 1) navigationFrame = requestAnimationFrame(animate);
            else {
                row.scrollTo({ left: destination, behavior: "instant" });
                stopNavigation();
            }
        }
        navigationFrame = requestAnimationFrame(animate);
    }

    // A swipe, wheel gesture or keyboard input immediately takes control back.
    ["pointerdown", "touchstart", "wheel", "keydown"].forEach(event => {
        row.addEventListener(event, stopNavigation, { passive: true });
    });
    window.addEventListener("resize", stopNavigation);
    reducedMotion.addEventListener("change", stopNavigation);

    function updateCardScales() {
        framePending = false;
        const horizontal = getComputedStyle(row).overflowX === "auto"
            && cards.length > 1;
        row.classList.toggle("is-horizontal", horizontal);
        controls.hidden = !horizontal || !carouselSettings.showControls;

        // Equal end padding lets the first and last cards snap to the middle too.
        if (horizontal) {
            const padding = Math.max(0, (row.clientWidth - slots[0].offsetWidth) / 2);
            row.style.setProperty("--carousel-padding", `${padding}px`);
        } else {
            row.style.removeProperty("--carousel-padding");
        }

        const stride = horizontal
            ? Math.max(1, slots[1].offsetLeft - slots[0].offsetLeft)
            : 1;
        const poses = cards.map((card, index) => {
            if (!horizontal || reducedMotion.matches) {
                return { scale: 1, opacity: 1, order: 0 };
            }
            // Slot geometry is unaffected by scaling or the entrance animation.
            const slot = slots[index];
            const center = slot.offsetLeft - row.scrollLeft + slot.offsetWidth / 2;
            const distance = (center - row.clientWidth / 2) / stride;
            const progress = Math.min(1, Math.abs(distance)
                / Math.max(0.1, carouselSettings.effectRange));
            // Position sets a direct target; CSS handles the ease-out once.
            // A second easing curve here would make the response feel hesitant.
            return {
                scale: 1 - (1 - carouselSettings.sideScale) * progress,
                opacity: 1 - (1 - carouselSettings.sideOpacity) * progress,
                order: Math.max(0, 100 - Math.round(Math.abs(distance) * 10)),
            };
        });

        cards.forEach((card, index) => {
            slots[index].style.setProperty("--scroll-scale", poses[index].scale.toFixed(4));
            slots[index].style.setProperty("--card-opacity", poses[index].opacity.toFixed(4));
            slots[index].style.setProperty("--card-order", poses[index].order);
        });

        activeIndex = horizontal ? Math.max(0, Math.min(cards.length - 1,
            Math.round(row.scrollLeft / stride))) : 0;
        dots.forEach((dot, index) => {
            dot.setAttribute("aria-current", index === activeIndex ? "true" : "false");
        });
        previous.disabled = activeIndex === 0;
        next.disabled = activeIndex === cards.length - 1;
    }

    function scheduleScaleUpdate() {
        if (framePending) return;
        framePending = true;
        requestAnimationFrame(updateCardScales);
    }

    row.addEventListener("scroll", () => {
        // Once swiping begins, no card should wait for its entrance delay.
        row.classList.add("has-scrolled");
        scheduleScaleUpdate();
    }, { passive: true });
    window.addEventListener("resize", scheduleScaleUpdate);
    reducedMotion.addEventListener("change", scheduleScaleUpdate);
    updateCardScales();
});
