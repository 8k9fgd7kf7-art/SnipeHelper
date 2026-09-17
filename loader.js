javascript:
(async function () {
    const repository = "8k9fgd7kf7-art/SnipeHelper";
    const fallbackFile = "releases/snipe-helper-v2.2.0.js";
    let scriptFile = fallbackFile;

    window.SNIPE_HELPER_CONFIG = {
        zielFarbe: "green",
        warteFarbe: "#ff9933",
        ohneDatumFarbe: "green",
        breite: null
    };

    try {
        const manifestUrl = "https://raw.githubusercontent.com/" + repository + "/main/latest.json?t=" + Date.now();
        const response = await fetch(manifestUrl, { cache: "no-store" });
        if (!response.ok) throw new Error("Manifest HTTP " + response.status);

        const manifest = await response.json();
        if (!manifest || !/^releases\/snipe-helper-v\d+\.\d+\.\d+\.js$/.test(manifest.file)) {
            throw new Error("Ungültiges Release-Manifest");
        }
        scriptFile = manifest.file;
    } catch (error) {
        console.warn("[Snipe-Helfer] Versionsprüfung fehlgeschlagen, Fallback wird geladen.", error);
    }

    $.getScript("https://cdn.jsdelivr.net/gh/" + repository + "@main/" + scriptFile)
        .fail(function () {
            if (window.UI?.ErrorMessage) {
                UI.ErrorMessage("Der Snipe-Helfer konnte nicht geladen werden.");
            } else {
                alert("Der Snipe-Helfer konnte nicht geladen werden.");
            }
        });
})();
