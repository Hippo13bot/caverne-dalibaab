/* EAN-13 interne : préfixes 20–29 réservés aux usages internes.
 * Ces numéros ne sont pas des identifiants commerciaux GS1.
 */
(() => {
  const L=['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
  const G=['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
  const R=L.map(s=>[...s].map(c=>c==='1'?'0':'1').join(''));
  const PARITY=['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
  function checksum(base){
    const s=String(base); if(!/^\d{12}$/.test(s)) throw new Error('Un EAN-13 doit commencer par 12 chiffres.');
    let sum=0; for(let i=0;i<12;i++) sum+=Number(s[i])*(i%2===0?1:3);
    return String((10-(sum%10))%10);
  }
  function valid(value){const s=String(value||'');return /^\d{13}$/.test(s)&&s[12]===checksum(s.slice(0,12))&&/^2[0-9]/.test(s);}
  function randomDigits(n){const a=new Uint8Array(n);crypto.getRandomValues(a);return [...a].map(v=>String(v%10)).join('');}
  function generate(used=new Set()){
    for(let attempt=0;attempt<10000;attempt++){
      const base=String(20+(crypto.getRandomValues(new Uint8Array(1))[0]%10))+randomDigits(10);
      const value=base+checksum(base); if(!used.has(value))return value;
    }
    throw new Error('Impossible de trouver un EAN-13 disponible.');
  }
  function modules(value){
    const s=String(value); if(!valid(s))throw new Error('EAN-13 invalide : '+s);
    let bits='101', parity=PARITY[Number(s[0])];
    for(let i=1;i<=6;i++)bits+=(parity[i-1]==='L'?L:G)[Number(s[i])];
    bits+='01010'; for(let i=7;i<=12;i++)bits+=R[Number(s[i])]; bits+='101';
    return bits;
  }
  function draw(ctx,value,{x=0,y=0,moduleWidth=2,barHeight=65,textY=y+80,fontSize=11,quiet=11}={}){
    const bits=modules(value), left=x+quiet*moduleWidth;
    ctx.fillStyle='#fff';ctx.fillRect(x,y,(bits.length+quiet*2)*moduleWidth,textY-y+fontSize+2);
    ctx.fillStyle='#000';
    for(let i=0;i<bits.length;i++)if(bits[i]==='1'){
      const guard=(i<3)||(i>=45&&i<50)||(i>=92);
      ctx.fillRect(left+i*moduleWidth,y,moduleWidth,barHeight+(guard?4:0));
    }
    ctx.font=`${fontSize}px Arial,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(value),x+(bits.length+quiet*2)*moduleWidth/2,textY);
  }
  function toSvg(value){
    const bits=modules(value),quiet=11,width=bits.length+quiet*2,height=40;
    let bars='';for(let i=0;i<bits.length;i++)if(bits[i]==='1'){
      const guard=(i<3)||(i>=45&&i<50)||(i>=92);
      bars+=`<rect x="${quiet+i}" y="0" width="1" height="${guard?33:29}"/>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="EAN-13 ${value}"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${bars}</g><text x="${width/2}" y="38" text-anchor="middle" font-family="Arial,sans-serif" font-size="5" fill="#000">${value}</text></svg>`;
  }
  function dataUri(value){return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(toSvg(value));}
  window.EAN13Barcode={checksum,valid,generate,modules,draw,toSvg,dataUri};
})();
