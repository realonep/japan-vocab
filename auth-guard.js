(function () {
    const loggedInUser = localStorage.getItem("loggedInUser");
    if (loggedInUser) return;

    const current = window.location.pathname.split("/").pop() || "";
    if (current === "index.html" || current === "") return;

    const next = current + window.location.search + window.location.hash;
    const encoded = encodeURIComponent(next);
    window.location.replace(`index.html?next=${encoded}`);
})();
