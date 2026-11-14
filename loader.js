// PWA loader: registers service worker, asks for password once, decrypts data bundle.
(function(){
  const PK = 'upjs-lf-heslo';
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
  function b2s(u8){ return new TextDecoder().decode(u8); }
  async function decrypt(buf, pass){
    const u8 = new Uint8Array(buf);
    if (b2s(u8.subarray(0,5)) !== 'UPJS1') throw new Error('Neplatný súbor s dátami');
    const salt = u8.subarray(5,21), iv = u8.subarray(21,33), ct = u8.subarray(33);
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({name:'PBKDF2', salt, iterations:250000, hash:'SHA-256'}, base, {name:'AES-GCM', length:256}, false, ['decrypt']);
    return await crypto.subtle.decrypt({name:'AES-GCM', iv}, key, ct);
  }
  async function getData(){
    const parts = await Promise.all(['data1.bin','data2.bin'].map(async f => {
      const r = await fetch(f); if (!r.ok) throw new Error('HTTP ' + r.status); return new Uint8Array(await r.arrayBuffer());
    }));
    const out = new Uint8Array(parts[0].length + parts[1].length);
    out.set(parts[0], 0); out.set(parts[1], parts[0].length);
    return out.buffer;
  }
  function askPassword(msg){
    return new Promise(res => {
      const app = document.getElementById('app');
      app.innerHTML = `<h1>Prijímačky na LF UPJŠ</h1>
        <div class="card"><p style="margin-top:0">Zadaj heslo k otázkam. Stačí raz, potom si ho appka zapamätá.</p>
        <input id="pw" type="password" autocomplete="current-password" autocapitalize="none" style="width:100%;padding:12px;border-radius:10px;border:1.5px solid var(--line);background:var(--bg);color:var(--ink);font-size:17px">
        ${msg?`<p style="color:var(--bad);margin:8px 0 0">${msg}</p>`:''}
        <button class="btn block" id="pwok" style="margin-top:12px">Pokračovať</button></div>`;
      const go = () => res(document.getElementById('pw').value.trim());
      document.getElementById('pwok').onclick = go;
      document.getElementById('pw').onkeydown = e => { if (e.key === 'Enter') go(); };
      document.getElementById('pw').focus();
    });
  }
  window.__PWA = async function(){
    let buf;
    try { buf = await getData(); }
    catch(e){
      document.getElementById('app').innerHTML = '<div class="card"><b>Otázky sa nepodarilo načítať.</b><p class="muted small">Pri úplne prvom spustení treba internet. Potom už appka funguje aj offline.</p></div>';
      return null;
    }
    let pass = null; try { pass = localStorage.getItem(PK); } catch(e){}
    let msg = '';
    for(;;){
      if (!pass) pass = await askPassword(msg);
      document.getElementById('app').innerHTML = '<div class="spin"></div><p class="center muted">Otváram otázky…</p>';
      try {
        const plain = await decrypt(buf, pass);
        try { localStorage.setItem(PK, pass); } catch(e){}
        return plain;
      } catch(e){
        pass = null; msg = 'Nesprávne heslo, skús to znova.';
        try { localStorage.removeItem(PK); } catch(e){}
      }
    }
  };
})();
