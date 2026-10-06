/* Fini — animações e componentes (JavaScript puro, sem bibliotecas) */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  /* ---------- Tela de carregamento ---------- */
  const start = performance.now();
  let loaded = false;
  const finish = () => {
    if (loaded) return;
    loaded = true;
    setTimeout(() => root.classList.add('loaded'), Math.max(0, 700 - (performance.now() - start)));
  };
  if (document.readyState === 'complete') finish();
  else addEventListener('load', finish);
  setTimeout(finish, 2500);

  /* ---------- Esteiras infinitas: duplica o conteúdo para o loop ficar sem emenda ---------- */
  $$('[data-marquee]').forEach(track => {
    $$(':scope > *', track).forEach(el => {
      const copy = el.cloneNode(true);
      copy.setAttribute('aria-hidden', 'true');
      track.append(copy);
    });
  });

  /* ---------- Títulos que sobem palavra por palavra ---------- */
  $$('.split').forEach(el => {
    const text = el.textContent.trim();
    el.setAttribute('aria-label', text);
    el.innerHTML = text.split(/\s+/)
      .map((w, i) => `<span class="word" aria-hidden="true"><span style="--i:${i}">${w}</span></span>`)
      .join(' ');
  });

  /* ---------- Aparecer ao rolar ---------- */
  const seen = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      seen.unobserve(e.target);
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
  $$('.reveal, .split').forEach(el => seen.observe(el));

  /* ---------- Contadores ---------- */
  const counters = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      counters.unobserve(e.target);
      const el = e.target, end = +el.dataset.count;
      if (reduce) { el.textContent = end; return; }
      const t0 = performance.now(), dur = 1600;
      const tick = now => {
        const t = clamp((now - t0) / dur);
        el.textContent = Math.round(end * (1 - Math.pow(1 - t, 4)));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.6 });
  $$('[data-count]').forEach(el => counters.observe(el));

  /* ---------- Texto embaralhado do hero ---------- */
  $$('.scramble').forEach(el => {
    const words = el.dataset.words.split('|');
    if (reduce || words.length < 2) return;
    const glyphs = 'abcdefghijklmnopqrstuvwxyz✦★';
    let i = 0;
    const next = () => {
      const to = words[i = (i + 1) % words.length];
      let frame = 0;
      const id = setInterval(() => {
        const done = Math.floor(frame++ / 2);
        el.textContent = [...to].map((ch, k) =>
          k < done || ch === ' ' ? ch : glyphs[Math.floor(Math.random() * glyphs.length)]).join('');
        if (done >= to.length) { clearInterval(id); setTimeout(next, 2200); }
      }, 40);
    };
    setTimeout(next, 3000);
  });

  /* ---------- Focus Reveal ---------- */
  $$('[data-focus]').forEach(el => {
    const text = el.textContent.trim();
    el.setAttribute('aria-label', text);
    el.textContent = '';
    const words = text.split(/\s+/).map(w => {
      const s = document.createElement('span');
      s.className = 'focus-word';
      s.textContent = w;
      s.setAttribute('aria-hidden', 'true');
      el.append(s, ' ');
      return s;
    });
    const frame = document.createElement('span');
    frame.className = 'focus-frame';
    frame.setAttribute('aria-hidden', 'true');
    frame.innerHTML = '<i></i><i></i><i></i><i></i>';
    el.append(frame);

    let current = 0, hovering = false, visible = false;
    // Mede a caixa de cada palavra, então funciona com qualquer fonte e tamanho
    const go = i => {
      current = i;
      const w = words[i], px = 12, py = 4;
      words.forEach((s, k) => s.classList.toggle('on', k === i));
      frame.style.transform = `translate(${w.offsetLeft - px}px, ${w.offsetTop - py}px)`;
      frame.style.width = `${w.offsetWidth + px * 2}px`;
      frame.style.height = `${w.offsetHeight + py * 2}px`;
      frame.classList.add('show');
    };
    words.forEach((w, i) => w.addEventListener('pointerenter', () => { hovering = true; go(i); }));
    el.addEventListener('pointerleave', () => { hovering = false; });
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(el);
    setInterval(() => { if (visible && !hovering && !reduce) go((current + 1) % words.length); }, 1800);
    addEventListener('resize', () => go(current));
    document.fonts?.ready.then(() => go(current));
    go(words.length - 1);
  });

  /* ---------- Card Folder: toque abre/fecha (no computador é o hover) ---------- */
  $$('.folder').forEach(f => {
    f.addEventListener('click', () => f.classList.toggle('open'));
    f.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f.classList.toggle('open'); }
    });
  });

  /* ---------- Carrossel em looping: setas, barra de progresso e arrastar com o mouse ----------
     Os cards são copiados uma vez antes e uma vez depois dos originais. Quando a rolagem
     para em uma das cópias, pulamos (sem animação) para o card original igual — o usuário
     não percebe e pode seguir para a esquerda ou para a direita sem fim. */
  $$('[data-carousel]').forEach(box => {
    const track = $('.carousel-track', box);
    const prev = $('[data-prev]', box), next = $('[data-next]', box), bar = $('.carousel-bar i', box);
    const originals = [...track.children];
    const count = originals.length;
    if (!count) return;

    const copy = el => {
      const c = el.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      return c;
    };
    track.prepend(...originals.map(copy));
    track.append(...originals.map(copy));

    const step = () => {
      const [a, b] = track.children;
      return b ? b.offsetLeft - a.offsetLeft : a.offsetWidth;
    };
    const setWidth = () => step() * count;

    // Mantém a rolagem sempre dentro do conjunto do meio; devolve quanto pulou
    const recenter = () => {
      const w = setWidth();
      let jump = 0;
      if (track.scrollLeft < w * 0.5) jump = w;
      else if (track.scrollLeft >= w * 1.5) jump = -w;
      if (jump) track.scrollLeft += jump;
      return jump;
    };

    // A barra mostra em qual dos cards originais estamos
    const update = () => {
      const index = ((Math.round(track.scrollLeft / step()) % count) + count) % count;
      bar.style.transform = `scaleX(${(index + 1) / count})`;
    };

    let idle;
    const settled = () => { if (!track.classList.contains('dragging')) recenter(); };
    track.addEventListener('scroll', () => {
      update();
      clearTimeout(idle);
      idle = setTimeout(settled, 140);
    }, { passive: true });
    track.addEventListener('scrollend', settled);

    prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
    addEventListener('resize', () => { recenter(); update(); });

    track.scrollLeft = setWidth();
    update();

    let down = false, moved = false, x0 = 0, s0 = 0;
    track.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; moved = false; x0 = e.clientX; s0 = track.scrollLeft;
    });
    addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - x0;
      if (!moved && Math.abs(dx) > 6) { moved = true; track.classList.add('dragging'); }
      if (!moved) return;
      track.scrollLeft = s0 - dx;
      s0 += recenter();   // arrastou até uma cópia: pula junto com o ponto de partida
    });
    addEventListener('pointerup', () => {
      if (!down) return;
      down = false;
      if (!moved) return;
      // Desliza até o card mais próximo antes de religar o "encaixe"
      const target = Math.round(track.scrollLeft / step()) * step();
      track.scrollTo({ left: target, behavior: 'smooth' });
      setTimeout(() => { track.classList.remove('dragging'); recenter(); }, 450);
    });
    track.addEventListener('dragstart', e => e.preventDefault());
  });

  /* ---------- Linha do tempo + barra de progresso (uma leitura de rolagem por frame) ---------- */
  const progress = $('.progress');
  const timelines = $$('[data-timeline]').map(el => ({ el, line: $('.tl-line', el), items: $$('.tl-item', el) }));
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const max = root.scrollHeight - innerHeight;
    progress.style.setProperty('--p', max > 0 ? scrollY / max : 0);
    timelines.forEach(({ el, line, items }) => {
      const r = el.getBoundingClientRect();
      const mark = innerHeight * 0.62;
      line.style.setProperty('--p', clamp((mark - r.top) / r.height));
      items.forEach(it => it.classList.toggle('on', it.getBoundingClientRect().top + 24 < mark));
    });
  };
  const requestScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } };
  addEventListener('scroll', requestScroll, { passive: true });
  addEventListener('resize', requestScroll);
  onScroll();

  /* ---------- Efeitos que dependem de mouse ---------- */
  if (fine && !reduce) {
    // Botões magnéticos
    $$('.magnetic').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        el.style.translate = `${(e.clientX - r.left - r.width / 2) * 0.3}px ${(e.clientY - r.top - r.height / 2) * 0.4}px`;
      });
      el.addEventListener('pointerleave', () => { el.style.translate = ''; });
    });

    // Cards que inclinam em 3D com brilho
    $$('.tilt').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.classList.add('tilting');
        el.style.setProperty('--ry', `${(x - 0.5) * 14}deg`);
        el.style.setProperty('--rx', `${(0.5 - y) * 12}deg`);
        el.style.setProperty('--gx', `${x * 100}%`);
        el.style.setProperty('--gy', `${y * 100}%`);
      });
      el.addEventListener('pointerleave', () => {
        el.classList.remove('tilting');
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      });
    });

    // Luz que segue o mouse no bento
    $$('.bento').forEach(grid => {
      const cards = $$('.spot', grid);
      grid.addEventListener('pointermove', e => {
        cards.forEach(c => {
          const r = c.getBoundingClientRect();
          c.style.setProperty('--mx', `${e.clientX - r.left}px`);
          c.style.setProperty('--my', `${e.clientY - r.top}px`);
        });
      });
    });

    // Estrelas do hero em parallax
    const hero = $('.hero'), stars = $('.stars');
    hero.addEventListener('pointermove', e => {
      stars.style.setProperty('--px', (e.clientX / innerWidth - 0.5) * 2);
      stars.style.setProperty('--py', (e.clientY / innerHeight - 0.5) * 2);
    });

    // Estrela que segue o cursor
    const cs = $('.cursor-star');
    let cx = 0, cy = 0, tx = 0, ty = 0, rot = 0, size = 1, big = false;
    addEventListener('pointermove', e => {
      tx = e.clientX; ty = e.clientY;
      if (!cs.classList.contains('show')) { cx = tx; cy = ty; cs.classList.add('show'); }
      big = !!e.target.closest('a, button, .folder, .work-card, .focus-word');
    });
    document.addEventListener('pointerleave', () => cs.classList.remove('show'));
    const follow = () => {
      const dx = tx - cx, dy = ty - cy;
      cx += dx * 0.16; cy += dy * 0.16;
      rot += 0.6 + Math.hypot(dx, dy) * 0.08;
      size += ((big ? 1.9 : 1) - size) * 0.18;
      cs.style.transform = `translate(${cx + 12}px, ${cy + 12}px) rotate(${rot}deg) scale(${size})`;
      requestAnimationFrame(follow);
    };
    follow();
  }

  /* ---------- Estrelinhas ao clicar ---------- */
  if (!reduce) {
    addEventListener('pointerdown', e => {
      for (let i = 0; i < 7; i++) {
        const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        s.setAttribute('class', 'star sparkle');
        s.innerHTML = '<use href="#star"/>';
        s.style.left = `${e.clientX - 7}px`;
        s.style.top = `${e.clientY - 7}px`;
        document.body.append(s);
        const a = (Math.PI * 2 * i) / 7 + Math.random() * 0.6;
        const d = 40 + Math.random() * 50;
        s.animate([
          { transform: 'translate(0, 0) scale(0.4) rotate(0deg)', opacity: 1 },
          { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px) scale(1.2) rotate(${180 + Math.random() * 180}deg)`, opacity: 0 }
        ], { duration: 650 + Math.random() * 250, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }).onfinish = () => s.remove();
      }
    });
  }

  /* ---------- Shader WebGL: gradiente líquido com granulado ----------
     Use em qualquer <canvas data-shader data-c1="#cor" data-c2="#cor" data-c3="#cor"> */
  const FRAG = `
    precision highp float;
    uniform vec2 u_res; uniform float u_time; uniform vec2 u_mouse;
    uniform vec3 u_c1, u_c2, u_c3;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
      return v;
    }
    void main() {
      vec2 p = gl_FragCoord.xy / u_res; p.x *= u_res.x / u_res.y;
      float t = u_time * 0.07;
      vec2 m = (u_mouse - 0.5) * 0.5;
      vec2 q = vec2(fbm(p * 1.3 + t + m), fbm(p * 1.3 - t + vec2(5.2, 1.3) - m));
      float n = fbm(p * 1.5 + q * 2.0 + vec2(t * 0.6, -t * 0.4));
      vec3 col = mix(u_c1, u_c2, smoothstep(0.3, 0.75, n));
      col = mix(col, u_c3, smoothstep(0.42, 0.8, q.x * n * 2.0) * 0.75);
      col += (hash(gl_FragCoord.xy + fract(u_time)) - 0.5) * 0.04;
      gl_FragColor = vec4(col, 1.0);
    }`;
  const VERT = 'attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }';
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);

  const shaders = $$('canvas[data-shader]').map(canvas => {
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) { canvas.remove(); return null; }
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return null; }
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = n => gl.getUniformLocation(prog, n);
    ['c1', 'c2', 'c3'].forEach(c => gl.uniform3fv(u('u_' + c), rgb(canvas.dataset[c])));

    const state = { visible: false, mouse: [0.5, 0.5], target: [0.5, 0.5] };
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, canvas.clientWidth * dpr);
      canvas.height = Math.max(1, canvas.clientHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(u('u_res'), canvas.width, canvas.height);
      state.draw(performance.now());
    };
    state.draw = now => {
      state.mouse[0] += (state.target[0] - state.mouse[0]) * 0.04;
      state.mouse[1] += (state.target[1] - state.mouse[1]) * 0.04;
      gl.uniform1f(u('u_time'), now / 1000);
      gl.uniform2f(u('u_mouse'), state.mouse[0], state.mouse[1]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    new ResizeObserver(resize).observe(canvas);
    new IntersectionObserver(([e]) => { state.visible = e.isIntersecting; }).observe(canvas);
    canvas.parentElement.addEventListener('pointermove', e => {
      const r = canvas.getBoundingClientRect();
      state.target = [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height];
    });
    return state;
  }).filter(Boolean);

  // Só desenha os shaders que estão na tela
  if (shaders.length && !reduce) {
    const loop = now => {
      shaders.forEach(s => s.visible && s.draw(now));
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
})();
