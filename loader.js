javascript:
window.SNIPE_HELPER_CONFIG = {
    zielFarbe: "green",
    warteFarbe: "#ff9933",
    ohneDatumFarbe: "green",
    breite: null
};

$.getScript("https://cdn.jsdelivr.net/gh/8k9fgd7kf7-art/SnipeHelper@main/releases/snipe-helper-v2.1.1.js")
    .fail(function () {
        if (window.UI?.ErrorMessage) {
            UI.ErrorMessage("Der Snipe-Helfer konnte nicht geladen werden.");
        } else {
            alert("Der Snipe-Helfer konnte nicht geladen werden.");
        }
    });
