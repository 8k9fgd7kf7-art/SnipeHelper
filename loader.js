javascript:
window.SNIPE_HELPER_CONFIG = {
    zielFarbe: "green",
    warteFarbe: "#ff9933",
    ohneDatumFarbe: "green",
    breite: null
};

$.getScript("https://cdn.jsdelivr.net/gh/8k9fgd7kf7-art/SnipeHelper@5270841594be4b2f0b3af544449c3807be35d44e6/snipe-helper.js")
    .fail(function () {
        if (window.UI?.ErrorMessage) {
            UI.ErrorMessage("Der Snipe-Helfer konnte nicht geladen werden.");
        } else {
            alert("Der Snipe-Helfer konnte nicht geladen werden.");
        }
    });
