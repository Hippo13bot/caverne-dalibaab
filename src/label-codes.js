/* Valeur encodée dans le QR « objet » (étiquette 1).
 * Format : CA-XXXXXXXX (11 caractères) → QR version 1 (21 × 21 modules), le plus gros possible sur 30 × 14 mm.
 * L'alphabet des références publiques exclut 0, 1, I, O pour éviter les confusions.
 */
(() => {
  const RE = /^CA-([2-9A-HJ-NP-Z]{8})$/;
  function objectQrValue(publicCode) {
    const code = String(publicCode || '').trim().toUpperCase();
    if (!/^[2-9A-HJ-NP-Z]{8}$/.test(code)) throw new Error('Référence publique invalide : ' + code);
    return 'CA-' + code;
  }
  function parseObjectQr(text) {
    const m = RE.exec(String(text || '').trim().toUpperCase());
    return m ? m[1] : '';
  }
  window.CavernCodes = { objectQrValue, parseObjectQr };
})();
