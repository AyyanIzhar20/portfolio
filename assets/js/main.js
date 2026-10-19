(() => {
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Splitting helpers ---------- */
  const splitRoll = (el) => {
    const text = el.textContent.trim();
    el.setAttribute('aria-label', el.getAttribute('aria-label') || text);
    const wrap = document.createElement('span');
    wrap.className = 'roll';
    wrap.setAttribute('aria-hidden', 'true');
    [...text].forEach((c, i) => {
      const s = document.createElement('span');
      s.className = 'roll-c';
      s.textContent = c;
      s.dataset.c = c;
      s.style.setProperty('--i', i);
      wrap.appendChild(s);
    });
    el.textContent = '';
    el.appendChild(wrap);
  };

  const splitChars = (el) => {
    el.querySelectorAll('.line').forEach((line) => {
      const text = line.textContent;
      line.textContent = '';
      [...text].forEach((c) => {
        const s = document.createElement('span');
        s.className = 'char';
        s.textContent = c === ' ' ? '\u00a0' : c;
        line.appendChild(s);
      });
    });
    el.querySelectorAll('.char').forEach((c, i) => c.style.setProperty('--i', i));
  };

  const splitWords = (el) => {
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'w';
            const wi = document.createElement('span');
            wi.className = 'wi';
            wi.textContent = part;
            wi.style.setProperty('--i', i++);
            w.appendChild(wi);
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') {
          walk(n);
        }
      });
    };
    walk(el);
  };

  document.querySelectorAll('[data-roll]').forEach(splitRoll);
  document.querySelectorAll('[data-words]').forEach(splitWords);
  const heroName = document.querySelector('.hero-name');
  if (heroName) splitChars(heroName);

  /* ---------- Fit hero name to the full width ---------- */
  const fit = () => {
    if (!heroName) return;
    heroName.style.fontSize = '';
    const avail = heroName.clientWidth;
    const w = heroName.querySelector('.name-inner').getBoundingClientRect().width;
    if (w > 0) {
      const size = parseFloat(getComputedStyle(heroName).fontSize);
      heroName.style.fontSize = `${Math.min(size * (avail / w), 380)}px`;
    }
  };

  /* ---------- Intro + page enter ---------- */
  const curtain = document.querySelector('.curtain');
  /* ---------- Smooth eased scrolling (in-out quart ≈ cubic-bezier(.76,0,.24,1)) ---------- */
  const easeInOut = (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);
  let scrollRaf = 0;
  const cancelScroll = () => { cancelAnimationFrame(scrollRaf); scrollRaf = 0; };
  ['wheel', 'touchstart', 'keydown'].forEach((ev) => window.addEventListener(ev, () => { if (scrollRaf) cancelScroll(); }, { passive: true }));
  const smoothTo = (y, done) => {
    cancelScroll();
    const max = document.documentElement.scrollHeight - innerHeight;
    const to = Math.max(0, Math.min(y, max));
    const from = scrollY;
    const dist = to - from;
    if (reduced || Math.abs(dist) < 2) { scrollTo(0, to); done && done(); return; }
    const dur = Math.min(1500, Math.max(650, Math.abs(dist) * 0.32));
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      scrollTo(0, from + dist * easeInOut(p));
      if (p < 1) scrollRaf = requestAnimationFrame(step);
      else { scrollRaf = 0; done && done(); }
    };
    scrollRaf = requestAnimationFrame(step);
  };
  const scrollToEl = (el) => smoothTo(el.getBoundingClientRect().top + scrollY, () => {
    el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  });
  const samePage = (url) => url.pathname.replace(/index\.html$/, '') === location.pathname.replace(/index\.html$/, '');

  /* Arriving from another page with a #hash: start at top behind the curtain, then glide down */
  const arrivalTarget = root.classList.contains('is-entering') && location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
  if (arrivalTarget) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    scrollTo(0, 0);
  }

  const start = () => {
    fit();
    if (arrivalTarget) scrollTo(0, 0);
    requestAnimationFrame(() => {
      root.classList.add('is-loaded');
      if (root.classList.contains('is-entering') && curtain) {
        curtain.classList.add('is-revealing');
        root.classList.remove('is-entering');
        curtain.addEventListener('transitionend', () => curtain.classList.remove('is-revealing'), { once: true });
        if (arrivalTarget) setTimeout(() => scrollToEl(arrivalTarget), 350);
      }
    });
  };
  sessionStorage.removeItem('pt');
  (document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]) : Promise.resolve()).then(start);
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(fit, 120); });

  /* ---------- Link handling: smooth in-page scroll, curtain wipe between pages ---------- */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return;

    if (samePage(url)) {
      const target = url.hash ? document.getElementById(decodeURIComponent(url.hash.slice(1))) : null;
      if (url.hash && !target) return;
      e.preventDefault();
      const wasOpen = root.classList.contains('menu-open');
      closeMenu();
      const go = () => (target ? scrollToEl(target) : smoothTo(0));
      wasOpen ? setTimeout(go, 220) : go();
      if (url.hash) history.pushState(null, '', url.hash);
      else if (location.hash) history.pushState(null, '', location.pathname);
      return;
    }

    if (reduced || !curtain) return;
    e.preventDefault();
    closeMenu();
    sessionStorage.setItem('pt', '1');
    curtain.classList.add('is-leaving');
    setTimeout(() => { location.href = url.href; }, 620);
  });
  window.addEventListener('pageshow', (e) => {
    if (e.persisted && curtain) {
      curtain.classList.remove('is-leaving');
      root.classList.remove('is-entering');
    }
  });

  /* ---------- Menu ---------- */
  const menu = document.getElementById('menu');
  const menuBtn = document.querySelector('.menu-btn');
  const setMenu = (open) => {
    if (!menu) return;
    root.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
    menu.inert = !open;
    if (open) setTimeout(() => menu.querySelector('a')?.focus({ preventScroll: true }), 300);
  };
  function closeMenu() { if (root.classList.contains('menu-open')) setMenu(false); }
  if (menu) {
    menu.inert = true;
    menu.querySelectorAll('.menu-link').forEach((l, i) => l.style.setProperty('--i', i));
    menuBtn.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && root.classList.contains('menu-open')) { setMenu(false); menuBtn.focus(); }
    });
  }

  /* ---------- Scroll reveals ---------- */
  const targets = document.querySelectorAll('[data-reveal], [data-words], .p-cover-frame');
  if ('IntersectionObserver' in window && !reduced) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.3, rootMargin: '0px 0px -5% 0px' });
    targets.forEach((t) => io.observe(t));
  } else {
    targets.forEach((t) => t.classList.add('is-in'));
  }

  /* ---------- Lazy videos (play only in view) ---------- */
  const videos = document.querySelectorAll('video[data-lazy]');
  const loadVideo = (v) => {
    if (v.dataset.loaded) return;
    v.querySelectorAll('source[data-src]').forEach((s) => { s.src = s.dataset.src; });
    v.load();
    v.dataset.loaded = '1';
  };
  if ('IntersectionObserver' in window) {
    const vio = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const v = en.target;
        if (en.isIntersecting) {
          loadVideo(v);
          if (!reduced) v.play().catch(() => {});
        } else if (!v.paused) v.pause();
      });
    }, { threshold: 0.15 });
    videos.forEach((v) => { if (!v.closest('.preview')) vio.observe(v); });
  }

  /* ---------- Local time (Islamabad) ---------- */
  const clocks = document.querySelectorAll('[data-clock]');
  if (clocks.length) {
    const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Karachi' });
    const tick = () => { const t = fmt.format(new Date()); clocks.forEach((c) => { c.textContent = t; }); };
    tick();
    setInterval(tick, 15000);
  }

  /* ---------- Work preview (spring-follow, stiffness 320 / damping 30) ---------- */
  const preview = document.querySelector('.preview');
  if (preview && window.matchMedia('(hover: hover)').matches) {
    const items = preview.querySelectorAll('.preview-item');
    const pos = { x: innerWidth / 2, y: innerHeight / 2, vx: 0, vy: 0 };
    const target = { x: pos.x, y: pos.y };
    let running = false;
    let last = 0;
    let activeVideo = null;
    const k = 320, c = 30;

    const step = (t) => {
      const dt = Math.min((t - last) / 1000 || 0.016, 0.032);
      last = t;
      const ax = -k * (pos.x - target.x) - c * pos.vx;
      const ay = -k * (pos.y - target.y) - c * pos.vy;
      pos.vx += ax * dt; pos.vy += ay * dt;
      pos.x += pos.vx * dt; pos.y += pos.vy * dt;
      const w = preview.offsetWidth, h = preview.offsetHeight;
      const rot = Math.max(-6, Math.min(6, pos.vx * 0.004));
      preview.style.transform = `translate3d(${pos.x - w / 2}px, ${pos.y - h / 2}px, 0) rotate(${rot}deg)`;
      const settled = Math.abs(pos.vx) + Math.abs(pos.vy) < 0.5 && Math.abs(pos.x - target.x) + Math.abs(pos.y - target.y) < 0.5;
      if (preview.classList.contains('is-active') || !settled) requestAnimationFrame(step);
      else running = false;
    };
    const run = () => { if (!running) { running = true; last = performance.now(); requestAnimationFrame(step); } };

    document.querySelectorAll('[data-preview]').forEach((link) => {
      link.addEventListener('mouseenter', (e) => {
        if (!preview.classList.contains('is-active')) {
          pos.x = target.x = e.clientX; pos.y = target.y = e.clientY; pos.vx = pos.vy = 0;
        }
        items.forEach((it) => it.classList.toggle('is-active', it.dataset.key === link.dataset.preview));
        const v = preview.querySelector(`video[data-key="${link.dataset.preview}"]`);
        if (activeVideo && activeVideo !== v) activeVideo.pause();
        if (v) { loadVideo(v); if (!reduced) v.play().catch(() => {}); activeVideo = v; }
        preview.classList.add('is-active');
        run();
      });
      link.addEventListener('mousemove', (e) => { target.x = e.clientX; target.y = e.clientY; run(); });
      link.addEventListener('mouseleave', () => {
        preview.classList.remove('is-active');
        if (activeVideo) activeVideo.pause();
      });
    });
  }

  /* ---------- Lightbox for project screenshots ---------- */
  const shots = document.querySelectorAll('[data-zoom]');
  if (shots.length && typeof HTMLDialogElement === 'function') {
    const dlg = document.createElement('dialog');
    dlg.className = 'lightbox';
    dlg.setAttribute('aria-label', 'Enlarged screenshot');
    dlg.innerHTML = '<button class="lightbox-close" type="button">Close</button><figure><img alt=""><figcaption class="lightbox-cap label"></figcaption></figure>';
    document.body.appendChild(dlg);
    const img = dlg.querySelector('img');
    const cap = dlg.querySelector('figcaption');
    shots.forEach((btn) => btn.addEventListener('click', () => {
      const src = btn.querySelector('img');
      img.src = src.currentSrc || src.src;
      img.alt = src.alt;
      cap.textContent = btn.dataset.zoom;
      dlg.showModal();
    }));
    dlg.addEventListener('click', () => dlg.close());
  }

  /* ---------- Inquiry form (Web3Forms, mailto fallback) ---------- */
  const EMAIL = 'ayyanizhar20@gmail.com';
  document.querySelectorAll('form[data-inquiry]').forEach((form) => {
    const key = form.dataset.key || '';
    const status = form.querySelector('.inquiry-status');
    const btn = form.querySelector('.inquiry-submit');
    const btnText = btn.querySelector('.inquiry-submit-text');
    const fields = {
      name: form.elements.name,
      email: form.elements.email,
      message: form.elements.message,
    };
    const messages = {
      name: 'Please add your name.',
      email: 'Please add a valid email so I can reply.',
      message: 'A line or two about the project helps.',
    };
    const setError = (k, on) => {
      const el = fields[k];
      const err = form.querySelector(`#${el.id}-error`);
      el.setAttribute('aria-invalid', String(on));
      if (err) err.textContent = on ? messages[k] : '';
    };
    Object.keys(fields).forEach((k) => fields[k].addEventListener('input', () => {
      if (fields[k].getAttribute('aria-invalid') === 'true' && fields[k].checkValidity()) setError(k, false);
    }));

    const collect = () => {
      const types = [...form.querySelectorAll('input[name="project_type"]:checked')].map((c) => c.value);
      return {
        name: fields.name.value.trim(),
        email: fields.email.value.trim(),
        company: form.elements.company.value.trim(),
        project_type: types.join(', ') || 'Not specified',
        message: fields.message.value.trim(),
      };
    };

    const mailtoFallback = (d) => {
      const body = `Name: ${d.name}\nEmail: ${d.email}\nCompany: ${d.company || '-'}\nProject type: ${d.project_type}\n\n${d.message}`;
      return `mailto:${EMAIL}?subject=${encodeURIComponent(`Project inquiry from ${d.name}`)}&body=${encodeURIComponent(body)}`;
    };

    const done = (name) => {
      form.innerHTML = `<div class="inquiry-done" role="status" tabindex="-1"><p class="label">Inquiry sent</p><h3>Thanks, ${name.replace(/[<>&"]/g, '')}.</h3><p>Your message is in my inbox. I'll reply to the email you shared.</p></div>`;
      form.querySelector('.inquiry-done').focus();
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      let firstBad = null;
      Object.keys(fields).forEach((k) => {
        const bad = !fields[k].value.trim() || !fields[k].checkValidity();
        setError(k, bad);
        if (bad && !firstBad) firstBad = fields[k];
      });
      if (firstBad) { firstBad.focus(); return; }
      if (form.elements.botcheck && form.elements.botcheck.checked) return;

      const d = collect();
      if (!key || key.startsWith('YOUR_')) {
        window.location.href = mailtoFallback(d);
        status.innerHTML = 'Your email app should open with the inquiry filled in.';
        return;
      }

      btn.disabled = true;
      btnText.textContent = 'Sending…';
      status.textContent = '';
      try {
        const res = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            access_key: key,
            subject: `Portfolio inquiry: ${d.project_type}`,
            from_name: 'Ayyan Izhar Portfolio',
            replyto: d.email,
            ...d,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || 'Request failed');
        done(d.name);
      } catch (err) {
        btn.disabled = false;
        btnText.textContent = 'Submit inquiry';
        status.innerHTML = `Something went wrong sending that. <a href="${mailtoFallback(d)}">Send it by email instead</a>.`;
      }
    });
  });
})();
