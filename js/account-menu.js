document.querySelectorAll(".account-menu").forEach((menu, index) => {
    const trigger = menu.querySelector(".account-menu-link");
    const dropdown = menu.querySelector(".account-dropdown");
    dropdown.id ||= `account-dropdown-${index}`;
    trigger.setAttribute("aria-controls", dropdown.id);
    let pinned = false;

    function setOpen(open) {
        menu.classList.toggle("is-open", open);
        trigger.setAttribute("aria-expanded", String(open));
    }

    function close() {
        pinned = false;
        setOpen(false);
    }

    menu.addEventListener("pointerenter", (event) => {
        if (event.pointerType === "mouse") setOpen(true);
    });
    menu.addEventListener("pointerleave", (event) => {
        if (event.pointerType === "mouse" && !pinned && !dropdown.contains(document.activeElement)) {
            setOpen(false);
        }
    });
    trigger.addEventListener("click", () => {
        pinned = !pinned;
        setOpen(pinned);
    });
    document.addEventListener("click", (event) => {
        if (!menu.contains(event.target)) close();
    });
    menu.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            event.preventDefault();
            close();
            trigger.focus();
        }
    });
    menu.addEventListener("focusout", (event) => {
        if (!menu.contains(event.relatedTarget)) close();
    });
    menu.addEventListener("close-account-menu", close);
});
