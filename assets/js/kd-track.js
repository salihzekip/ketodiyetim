/* ============================================================
   KetoDiyetim — Dönüşüm Takibi + Lead Yakalama
   ------------------------------------------------------------
   KURULUM: bu dosyayı /assets/js/kd-track.js olarak yükle ve
   index.html'de </body> ETİKETİNDEN HEMEN ÖNCE şunu ekle:

       <script src="/assets/js/kd-track.js" defer></script>

   Mevcut hiçbir koda dokunmaz. Sadece dinler ve raporlar.
   ============================================================ */
(function () {
  'use strict';

  // ---- AYAR --------------------------------------------------
  // Lead'lerin gönderileceği adres. Kurulunca buraya yapıştırılır.
  // BOŞ OLSA BİLE lead kaybolmaz: tarayıcıda saklanır ve
  // konsoldan kdLeadler() ile alınabilir.
  var LEAD_ENDPOINT = '';
  // ------------------------------------------------------------

  // Bu ziyarete özel kimlik — aynı kişiyi iki kez kaydetmemek için
  var OTURUM = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 8);

  function ev(name, params) {
    if (typeof gtag === 'function') gtag('event', name, params || {});
    if (window.KD_DEBUG) console.log('[KD]', name, params || {});
  }
  var fired = {};
  function once(name, params) {
    if (fired[name]) return;
    fired[name] = 1;
    ev(name, params);
  }

  /* ---------- 1) HUNİ: kullanıcı nereye kadar geliyor ---------- */
  var marks = [
    ['program', 'form_gorundu'],
    ['pricing', 'fiyat_gorundu'],
    ['nasil',   'nasil_calisir_gorundu'],
    ['blog',    'blog_gorundu']
  ];
  if ('IntersectionObserver' in window) {
    marks.forEach(function (m) {
      var el = document.getElementById(m[0]);
      if (!el) return;
      new IntersectionObserver(function (entries, obs) {
        if (entries[0].isIntersecting) { once(m[1]); obs.disconnect(); }
      }, { threshold: 0.25 }).observe(el);
    });
  }

  /* ---------- 2) Forma DOKUNAN kişi (niyet sinyali) ---------- */
  var fields = ['f_name', 'f_age', 'f_weight', 'f_height', 'f_goal'];
  fields.forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('focus', function () { once('form_basladi', { alan: id }); });
    el.addEventListener('change', function () { ev('form_alan_dolduruldu', { alan: id }); });
  });

  /* ---------- 3) TERK ETME: başladı ama bitirmedi ---------- */
  var planOlusturuldu = false;
  window.addEventListener('beforeunload', function () {
    if (fired['form_basladi'] && !planOlusturuldu) {
      ev('form_terk_edildi', { doldurulan: doluAlanSayisi() });
    }
  });
  function doluAlanSayisi() {
    var n = 0;
    fields.forEach(function (id) {
      var el = document.getElementById(id);
      if (el && String(el.value).trim() !== '') n++;
    });
    return n;
  }

  /* ---------- 4) PLAN OLUŞTU + LEAD YAKALA ---------- */
  // Plan bölümü DOM'a geldiğinde yakala (koda dokunmadan)
  var planHedef = document.getElementById('program') || document.body;
  new MutationObserver(function () {
    var metin = document.body.innerText || document.body.textContent || '';
    var kilitli = metin.indexOf('Kilidi Aç') > -1 ||
                  metin.indexOf('Günler Kilitli') > -1;
    if (kilitli && !planOlusturuldu) {
      planOlusturuldu = true;
      var p = profilOku();
      ev('plan_olusturuldu', { yas: p.yas, kilo: p.kilo, hedef: p.hedef });
      leadGonder(p);
      epostaIsteGoster(p);
    }
  }).observe(planHedef, { childList: true, subtree: true });

  function profilOku() {
    function v(id) { var e = document.getElementById(id); return e ? String(e.value).trim() : ''; }
    return {
      ad: v('f_name'), yas: v('f_age'), kilo: v('f_weight'),
      boy: v('f_height'), hedef: v('f_goal'),
      kaynak: document.referrer || 'direkt',
      sayfa: location.pathname,
      tarih: new Date().toISOString()
    };
  }

  function leadGonder(p, eposta) {
    if (eposta) p.eposta = eposta;

    // 1) Her hâlükârda tarayıcıda sakla — hiçbir lead kaybolmasın.
    //    Aynı ziyaret için tek kayıt tut, e-posta gelince güncelle.
    try {
      var liste = JSON.parse(localStorage.getItem('kd-leadler') || '[]');
      var son = liste.length ? liste[liste.length - 1] : null;
      if (son && son._oturum === OTURUM) {
        liste[liste.length - 1] = p;      // aynı ziyaret: üzerine yaz
      } else {
        liste.push(p);                     // yeni ziyaret: ekle
      }
      p._oturum = OTURUM;
      localStorage.setItem('kd-leadler', JSON.stringify(liste.slice(-200)));
    } catch (e) { /* kota dolu olabilir, sorun değil */ }

    // 2) Endpoint kuruluysa oraya da gönder (sadece e-posta varken)
    if (!LEAD_ENDPOINT || !eposta) return;
    try {
      fetch(LEAD_ENDPOINT, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(p)
      });
    } catch (e) { /* sessizce geç */ }
  }

  // Konsoldan lead'leri okumak için: kdLeadler()
  window.kdLeadler = function () {
    try { return JSON.parse(localStorage.getItem('kd-leadler') || '[]'); }
    catch (e) { return []; }
  };

  /* ---------- 5) E-POSTA YAKALAMA (planın hemen altına) ---------- */
  function epostaIsteGoster(p) {
    if (document.getElementById('kd-lead-box')) return;
    var box = document.createElement('div');
    box.id = 'kd-lead-box';
    box.style.cssText =
      'margin:24px auto;max-width:520px;padding:20px;border-radius:14px;' +
      'background:#111;color:#fff;font-family:inherit;text-align:center;' +
      'box-shadow:0 8px 30px rgba(0,0,0,.25)';
    box.innerHTML =
      '<div style="font-size:17px;font-weight:700;margin-bottom:6px">' +
        '4–7. günlerin de hazır olsun mu?' +
      '</div>' +
      '<div style="font-size:13px;opacity:.75;margin-bottom:14px">' +
        'E-postanı bırak, devam günlerini ve haftalık keto rehberini ' +
        'hazırlayıp sana ulaştıralım.' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">' +
        '<input id="kd-lead-mail" type="email" placeholder="e-posta adresin" ' +
          'style="flex:1;min-width:200px;padding:12px 14px;border-radius:10px;' +
          'border:1px solid #333;background:#1c1c1c;color:#fff;font-size:14px">' +
        '<button id="kd-lead-btn" style="padding:12px 20px;border:0;border-radius:10px;' +
          'background:#16a34a;color:#fff;font-weight:700;cursor:pointer;font-size:14px">' +
          'Gönder</button>' +
      '</div>' +
      '<div id="kd-lead-msg" style="font-size:12px;margin-top:10px;opacity:.7"></div>';

    var anchor = document.getElementById('pricing');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor);
    else document.body.appendChild(box);

    once('eposta_kutusu_gorundu');

    document.getElementById('kd-lead-btn').addEventListener('click', function () {
      var mail = document.getElementById('kd-lead-mail').value.trim();
      var msg = document.getElementById('kd-lead-msg');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
        msg.textContent = 'Geçerli bir e-posta gir lütfen.';
        msg.style.color = '#f87171';
        return;
      }
      leadGonder(p, mail);
      ev('lead_yakalandi', { yontem: 'eposta' });

      // WhatsApp'a hazır mesaj: lead doğrudan sana ulaşsın
      var msj = 'Merhaba! 3 günlük ücretsiz planımı oluşturdum, ' +
                '4-7. günleri de istiyorum.\n\n' +
                'Ad: ' + (p.ad || '-') + '\n' +
                'E-posta: ' + mail + '\n' +
                'Yaş: ' + (p.yas || '-') + ' | Kilo: ' + (p.kilo || '-') +
                ' | Boy: ' + (p.boy || '-') + ' | Hedef: ' + (p.hedef || '-');
      var wa = 'https://wa.me/905423548668?text=' + encodeURIComponent(msj);

      box.innerHTML =
        '<div style="font-weight:700;font-size:16px;margin-bottom:6px">' +
          '✓ Kaydettik!' +
        '</div>' +
        '<div style="font-size:13px;opacity:.75;margin-bottom:14px">' +
          'Devam günlerini hemen almak için WhatsApp\'tan yaz — ' +
          'bilgilerin mesaja hazır eklendi.' +
        '</div>' +
        '<a id="kd-wa-btn" href="' + wa + '" target="_blank" rel="noopener" ' +
          'style="display:inline-block;padding:13px 22px;border-radius:10px;' +
          'background:#25D366;color:#fff;font-weight:700;text-decoration:none;' +
          'font-size:14px">WhatsApp\'tan Devam Et →</a>';

      var waBtn = document.getElementById('kd-wa-btn');
      if (waBtn) waBtn.addEventListener('click', function () {
        ev('lead_whatsappa_gitti', { yontem: 'eposta_sonrasi' });
      });
    });
  }

  /* ---------- 6) SATIN ALMA NİYETİ: WhatsApp tıklamaları ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="wa.me"], a[href*="whatsapp"]');
    if (a) {
      var kart = a.closest('[class*="price"], [class*="pack"], [class*="card"]');
      var kartMetin = kart ? (kart.innerText || kart.textContent || '') : '';
      var paket = kartMetin.trim().split('\n')[0].slice(0, 40) || 'genel';
      ev('whatsapp_tiklandi', { paket: paket, konum: location.hash || 'sayfa' });
      return;
    }
    var b = e.target.closest && e.target.closest('button, a');
    if (b) {
      var t = (b.innerText || b.textContent || '').trim();
      if (/excel/i.test(t))       ev('excel_indirildi');
      if (/kilidi a/i.test(t))    ev('kilit_tiklandi');
      if (/planımı oluştur/i.test(t)) ev('plan_butonu_tiklandi');
    }
  }, true);

  /* ---------- 7) Derin scroll (blog için) ---------- */
  var derin = false;
  window.addEventListener('scroll', function () {
    if (derin) return;
    var oran = (window.scrollY + window.innerHeight) / document.body.scrollHeight;
    if (oran > 0.75) { derin = true; once('derin_scroll_75'); }
  }, { passive: true });

})();
