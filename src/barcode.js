/*
 * Code 128-B renderer for La Caverne d'Alibaab.
 * The Code 128 symbol-pattern table is reproduced from ReportLab's Code 128
 * implementation by Tyler C. Sarna, under the following BSD-style license.
 *
 * Copyright (c) 2000 Tyler C. Sarna <tsarna@sarna.org>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 * 1. Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 * 3. All advertising materials mentioning features or use of this software
 *    must display the following acknowledgement:
 *    "This product includes software developed by Tyler C. Sarna."
 * 4. Neither the name of the author nor the names of contributors may be used
 *    to endorse or promote products derived from this software without prior
 *    written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */
const CODE128_PATTERNS = ["BaBbBb", "BbBaBb", "BbBbBa", "AbAbBc", "AbAcBb", "AcAbBb", "AbBbAc", "AbBcAb", "AcBbAb", "BbAbAc", "BbAcAb", "BcAbAb", "AaBbCb", "AbBaCb", "AbBbCa", "AaCbBb", "AbCaBb", "AbCbBa", "BbCbAa", "BbAaCb", "BbAbCa", "BaCbAb", "BbCaAb", "CaBaCa", "CaAbBb", "CbAaBb", "CbAbBa", "CaBbAb", "CbBaAb", "CbBbAa", "BaBaBc", "BaBcBa", "BcBaBa", "AaAcBc", "AcAaBc", "AcAcBa", "AaBcAc", "AcBaAc", "AcBcAa", "BaAcAc", "BcAaAc", "BcAcAa", "AaBaCc", "AaBcCa", "AcBaCa", "AaCaBc", "AaCcBa", "AcCaBa", "CaCaBa", "BaAcCa", "BcAaCa", "BaCaAc", "BaCcAa", "BaCaCa", "CaAaBc", "CaAcBa", "CcAaBa", "CaBaAc", "CaBcAa", "CcBaAa", "CaDaAa", "BbAdAa", "DcAaAa", "AaAbBd", "AaAdBb", "AbAaBd", "AbAdBa", "AdAaBb", "AdAbBa", "AaBbAd", "AaBdAb", "AbBaAd", "AbBdAa", "AdBaAb", "AdBbAa", "BdAbAa", "BbAaAd", "DaCaAa", "BdAaAb", "AcDaAa", "AaAbDb", "AbAaDb", "AbAbDa", "AaDbAb", "AbDaAb", "AbDbAa", "DaAbAb", "DbAaAb", "DbAbAa", "BaBaDa", "BaDaBa", "DaBaBa", "AaAaDc", "AaAcDa", "AcAaDa", "AaDaAc", "AaDcAa", "DaAaAc", "DaAcAa", "AaCaDa", "AaDaCa", "CaAaDa", "DaAaCa", "BaAdAb", "BaAbAd", "BaAbCb", "BcCaAaB"];
(function(){
  function code128B(value){
    const text=String(value||'');
    if(!text || [...text].some(ch=>ch.charCodeAt(0)<32 || ch.charCodeAt(0)>126)) throw new Error('Le code-barres accepte uniquement les caractères ASCII imprimables.');
    const codes=[104,...[...text].map(ch=>ch.charCodeAt(0)-32)];
    let checksum=codes[0];
    for(let i=1;i<codes.length;i++) checksum+=codes[i]*i;
    codes.push(checksum%103,106);
    return codes;
  }
  function toSvg(value, opts={}){
    const codes=code128B(value), module=2, height=56, quiet=10;
    let x=quiet, bars='';
    for(const code of codes){
      const pattern=CODE128_PATTERNS[code];
      for(let i=0;i<pattern.length;i++){
        const ch=pattern[i], width=(ch===ch.toUpperCase()?ch.charCodeAt(0)-64:ch.charCodeAt(0)-96)*module;
        if(i%2===0) bars+=`<rect x="${x}" y="0" width="${width}" height="${height}" fill="#111"/>`;
        x+=width;
      }
    }
    const width=x+quiet;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height+17}" role="img" aria-label="Code-barres ${String(value).replace(/[&<>"]/g,' ')}"><rect width="100%" height="100%" fill="#fff"/>${bars}<text x="${width/2}" y="${height+13}" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" fill="#111">${String(value).replace(/[&<>"]/g,' ')}</text></svg>`;
  }
  function dataUri(value,opts){return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(toSvg(value,opts));}
  window.Code128Barcode={toSvg,dataUri,encode:code128B};
})();
