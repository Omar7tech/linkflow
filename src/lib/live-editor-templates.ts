/**
 * Starter sketches.
 *
 * Each one is meant to be read as much as run: short enough to take in at a
 * glance, complete enough to be worth pulling apart. They cover a spread of
 * techniques — pure CSS, canvas, pointer input, observers, state — so there's
 * something to start from whatever you opened the editor for.
 */

export interface SketchTemplate {
  id: string;
  name: string;
  blurb: string;
  html: string;
  css: string;
  js: string;
  libs?: string[];
}

export const SKETCH_TEMPLATES: readonly SketchTemplate[] = [
  {
    id: "blank",
    name: "Beginner HTML page",
    blurb: "A complete page with html, head and body",
    html: `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My first page</title>
</head>
<body>
  <main>
    <h1>Hello there</h1>
    <p>Edit the HTML, CSS, and JavaScript panes to build your page.</p>
  </main>
</body>
</html>`,
    css: `body {
  display: grid;
  place-items: center;
  min-height: 100vh;
  background: #0b0f0e;
  color: #e6f2ee;
  font-family: system-ui, sans-serif;
}

h1 {
  margin: 0 0 0.5rem;
  font-size: clamp(2rem, 8vw, 3.5rem);
  letter-spacing: -0.03em;
}

p {
  margin: 0;
  color: #7f9c92;
}`,
    js: `console.log('Ready. Press Ctrl+Enter to re-run.')`,
  },

  {
    id: "tailwind-start",
    name: "Tailwind starter",
    blurb: "Utility classes with Tailwind autocomplete enabled",
    html: `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Tailwind page</title>
</head>
<body class="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6">
  <main class="w-full max-w-md rounded-2xl bg-gray-800 p-8 shadow-xl">
    <p class="text-sm font-semibold text-emerald-500">My first Tailwind page</p>
    <h1 class="mt-2 text-3xl font-bold tracking-tight">Build something great</h1>
    <p class="mt-4 text-gray-500 leading-relaxed">Type inside a class attribute to see Tailwind suggestions.</p>
    <button class="mt-8 rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-black transition hover:opacity-80">
      Get started
    </button>
  </main>
</body>
</html>`,
    css: `/* Tailwind handles the styling for this starter. */`,
    js: `console.log('Tailwind is ready.')`,
    libs: ["tailwind"],
  },

  {
    id: "glass",
    name: "Glass panel",
    blurb: "Frosted card over an animated gradient",
    html: `<div class="stage">
  <div class="orb orb-a"></div>
  <div class="orb orb-b"></div>

  <article class="card">
    <span class="pill">Live preview</span>
    <h1>Glassmorphism, tuned</h1>
    <p>Backdrop blur, a hairline border and a specular sweep across the top edge.</p>
    <button>Get started</button>
  </article>
</div>`,
    css: `body { margin: 0; background: #05070a; }

.stage {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 100vh;
  overflow: hidden;
  font-family: system-ui, sans-serif;
}

.orb {
  position: absolute;
  width: 34rem;
  height: 34rem;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.55;
}

.orb-a { background: #10b981; top: -8rem; left: -6rem; animation: drift 14s ease-in-out infinite; }
.orb-b { background: #6366f1; bottom: -10rem; right: -6rem; animation: drift 18s ease-in-out infinite reverse; }

@keyframes drift {
  50% { transform: translate3d(6rem, 4rem, 0) scale(1.15); }
}

.card {
  position: relative;
  z-index: 1;
  width: min(26rem, 88vw);
  padding: 2.25rem;
  border-radius: 1.5rem;
  border: 1px solid rgb(255 255 255 / 18%);
  background: rgb(255 255 255 / 8%);
  backdrop-filter: blur(24px) saturate(1.4);
  box-shadow: 0 30px 80px rgb(0 0 0 / 45%);
  color: #f8fafc;
  overflow: hidden;
}

.card::before {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 70%), transparent);
}

.pill {
  display: inline-block;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  background: rgb(16 185 129 / 18%);
  color: #6ee7b7;
  font-size: 0.7rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

h1 { margin: 1rem 0 0.5rem; font-size: 1.9rem; letter-spacing: -0.02em; }
p { margin: 0 0 1.75rem; color: rgb(248 250 252 / 72%); line-height: 1.6; }

button {
  padding: 0.7rem 1.4rem;
  border: 0;
  border-radius: 0.75rem;
  background: #10b981;
  color: #04140f;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

button:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgb(16 185 129 / 35%); }`,
    js: "",
  },

  {
    id: "neon-grid",
    name: "Neon grid login",
    blurb: "Reactive tile field behind a floating-label form",
    html: `<section class="grid" id="grid"></section>

<form class="panel" onsubmit="return false">
  <h2>Sign in</h2>

  <label class="field">
    <input type="text" required>
    <span>Username</span>
  </label>

  <label class="field">
    <input type="password" required>
    <span>Password</span>
  </label>

  <button type="submit">Enter</button>
</form>`,
    css: `body {
  margin: 0;
  display: grid;
  place-items: center;
  min-height: 100vh;
  background: #000;
  font-family: system-ui, sans-serif;
  overflow: hidden;
}

.grid {
  position: fixed;
  inset: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 2px;
}

.grid::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(#000, #10b981, #000);
  animation: sweep 6s linear infinite;
}

@keyframes sweep {
  from { transform: translateY(-100%); }
  to { transform: translateY(100%); }
}

.grid span {
  position: relative;
  z-index: 2;
  width: calc(6.25vw - 2px);
  height: calc(6.25vw - 2px);
  background: #0b0b0b;
  transition: background 1.4s;
}

.grid span:hover { background: #34d399; transition: background 0s; }

.panel {
  position: relative;
  z-index: 10;
  width: min(23rem, 86vw);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 2.5rem;
  border-radius: 0.75rem;
  background: #141414;
  box-shadow: 0 20px 60px rgb(0 0 0 / 80%);
}

h2 {
  margin: 0;
  color: #34d399;
  font-size: 1.6rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.field { position: relative; display: block; }

.field input {
  width: 100%;
  padding: 1.5rem 0.75rem 0.5rem;
  border: 0;
  border-radius: 0.4rem;
  background: #222;
  color: #fff;
  font-size: 1rem;
  outline: none;
}

.field span {
  position: absolute;
  left: 0.75rem;
  top: 1rem;
  color: #888;
  pointer-events: none;
  transition: 0.3s ease;
}

.field input:focus ~ span,
.field input:valid ~ span {
  top: 0.45rem;
  font-size: 0.7rem;
  color: #34d399;
}

button {
  padding: 0.85rem;
  border: 0;
  border-radius: 0.4rem;
  background: #34d399;
  color: #04140f;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  cursor: pointer;
}

button:active { opacity: 0.7; }

@media (max-width: 900px) { .grid span { width: calc(10vw - 2px); height: calc(10vw - 2px); } }
@media (max-width: 600px) { .grid span { width: calc(20vw - 2px); height: calc(20vw - 2px); } }`,
    js: `// Fill the backdrop with tiles instead of writing 256 spans by hand.
const grid = document.getElementById('grid')
const tiles = 260

for (let i = 0; i < tiles; i++) {
  grid.appendChild(document.createElement('span'))
}

console.log('Tiles rendered:', tiles)`,
  },

  {
    id: "particles",
    name: "Constellation",
    blurb: "Canvas particle field that links nearby points",
    html: `<canvas id="scene"></canvas>
<h1>Move the pointer</h1>`,
    css: `body { margin: 0; background: #04070d; overflow: hidden; }

canvas { display: block; width: 100vw; height: 100vh; }

h1 {
  position: fixed;
  inset: auto 0 2rem;
  margin: 0;
  text-align: center;
  color: rgb(226 232 240 / 45%);
  font: 500 0.85rem/1 ui-monospace, monospace;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  pointer-events: none;
}`,
    js: `const canvas = document.getElementById('scene')
const ctx = canvas.getContext('2d')

let width, height, points
const pointer = { x: -999, y: -999 }
const COUNT = 90
const LINK = 130

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  width = canvas.width = innerWidth * dpr
  height = canvas.height = innerHeight * dpr
  ctx.scale(1, 1)
}

function seed() {
  points = Array.from({ length: COUNT }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.6,
    vy: (Math.random() - 0.5) * 0.6,
  }))
}

function frame() {
  ctx.clearRect(0, 0, width, height)

  for (const p of points) {
    p.x += p.vx
    p.y += p.vy
    if (p.x < 0 || p.x > width) p.vx *= -1
    if (p.y < 0 || p.y > height) p.vy *= -1

    ctx.beginPath()
    ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2)
    ctx.fillStyle = '#34d399'
    ctx.fill()
  }

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[i].x - points[j].x
      const dy = points[i].y - points[j].y
      const dist = Math.hypot(dx, dy)
      if (dist > LINK) continue

      ctx.strokeStyle = 'rgba(52, 211, 153, ' + (1 - dist / LINK) * 0.35 + ')'
      ctx.beginPath()
      ctx.moveTo(points[i].x, points[i].y)
      ctx.lineTo(points[j].x, points[j].y)
      ctx.stroke()
    }

    const pd = Math.hypot(points[i].x - pointer.x, points[i].y - pointer.y)
    if (pd < 180) {
      ctx.strokeStyle = 'rgba(125, 211, 252, ' + (1 - pd / 180) * 0.6 + ')'
      ctx.beginPath()
      ctx.moveTo(points[i].x, points[i].y)
      ctx.lineTo(pointer.x, pointer.y)
      ctx.stroke()
    }
  }

  requestAnimationFrame(frame)
}

addEventListener('resize', () => { resize(); seed() })
addEventListener('pointermove', (e) => {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  pointer.x = e.clientX * dpr
  pointer.y = e.clientY * dpr
})

resize()
seed()
frame()`,
  },

  {
    id: "gallery",
    name: "Grid gallery",
    blurb: "Auto-fitting CSS grid with hover captions",
    html: `<header>
  <h1>Field notes</h1>
  <p>A responsive grid that reflows without a single media query.</p>
</header>

<section class="gallery">
  <figure style="--hue: 160"><figcaption>Moss</figcaption></figure>
  <figure style="--hue: 190"><figcaption>Tide</figcaption></figure>
  <figure style="--hue: 230"><figcaption>Dusk</figcaption></figure>
  <figure style="--hue: 280"><figcaption>Bloom</figcaption></figure>
  <figure style="--hue: 20"><figcaption>Ember</figcaption></figure>
  <figure style="--hue: 45"><figcaption>Dune</figcaption></figure>
</section>`,
    css: `body {
  margin: 0;
  padding: 3rem 1.5rem 4rem;
  background: #0a0a0a;
  color: #fafafa;
  font-family: system-ui, sans-serif;
}

header { max-width: 40rem; margin: 0 auto 2.5rem; }
h1 { margin: 0 0 0.5rem; font-size: clamp(2rem, 6vw, 3rem); letter-spacing: -0.03em; }
header p { margin: 0; color: #8b8b8b; }

.gallery {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  max-width: 62rem;
  margin: 0 auto;
}

figure {
  position: relative;
  margin: 0;
  aspect-ratio: 4 / 3;
  border-radius: 1rem;
  overflow: hidden;
  background:
    radial-gradient(120% 120% at 20% 10%, hsl(var(--hue) 70% 55%), hsl(var(--hue) 60% 22%));
  cursor: pointer;
  transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
}

figure::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(transparent 45%, rgb(0 0 0 / 70%));
  opacity: 0;
  transition: opacity 0.35s ease;
}

figure:hover { transform: translateY(-6px) scale(1.02); }
figure:hover::after { opacity: 1; }

figcaption {
  position: absolute;
  z-index: 1;
  inset: auto 0 0;
  padding: 1rem 1.15rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  transform: translateY(120%);
  transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
}

figure:hover figcaption { transform: translateY(0); }

/* Give the first tile twice the width once there's room for it. */
@supports (grid-column: span 2) {
  figure:first-child { grid-column: span 2; }
}`,
    js: "",
  },

  {
    id: "tilt",
    name: "3D tilt card",
    blurb: "Pointer-driven perspective with a moving sheen",
    html: `<div class="scene">
  <article class="card" id="card">
    <div class="sheen"></div>
    <span class="tag">Interactive</span>
    <h2>Tilt me</h2>
    <p>Rotation is driven by the pointer's offset from the centre.</p>
  </article>
</div>`,
    css: `body {
  margin: 0;
  display: grid;
  place-items: center;
  min-height: 100vh;
  background: radial-gradient(circle at 50% 0%, #123, #05070a 60%);
  font-family: system-ui, sans-serif;
}

.scene { perspective: 900px; }

.card {
  position: relative;
  width: min(22rem, 84vw);
  padding: 2.5rem 2rem;
  border-radius: 1.25rem;
  border: 1px solid rgb(255 255 255 / 12%);
  background: linear-gradient(160deg, #14211d, #0b1210);
  color: #e8f5f0;
  overflow: hidden;
  transform-style: preserve-3d;
  transition: transform 0.12s ease-out;
  box-shadow: 0 40px 90px rgb(0 0 0 / 55%);
}

.sheen {
  position: absolute;
  inset: -40%;
  background: radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgb(52 211 153 / 35%), transparent 45%);
  pointer-events: none;
}

.tag {
  display: inline-block;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: rgb(52 211 153 / 15%);
  color: #6ee7b7;
  font-size: 0.68rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

h2 { margin: 0.9rem 0 0.4rem; font-size: 1.8rem; letter-spacing: -0.02em; }
p { margin: 0; color: rgb(232 245 240 / 65%); line-height: 1.6; }`,
    js: `const card = document.getElementById('card')
const MAX_TILT = 12

card.addEventListener('pointermove', (event) => {
  const rect = card.getBoundingClientRect()
  const px = (event.clientX - rect.left) / rect.width
  const py = (event.clientY - rect.top) / rect.height

  card.style.transform =
    'rotateY(' + (px - 0.5) * MAX_TILT * 2 + 'deg) ' +
    'rotateX(' + (0.5 - py) * MAX_TILT * 2 + 'deg)'

  card.style.setProperty('--mx', px * 100 + '%')
  card.style.setProperty('--my', py * 100 + '%')
})

card.addEventListener('pointerleave', () => {
  card.style.transform = 'rotateX(0) rotateY(0)'
})`,
  },

  {
    id: "scroll",
    name: "Scroll reveal",
    blurb: "IntersectionObserver staggering sections in",
    html: `<header>
  <h1>Scroll down</h1>
  <p>Each block fades up the first time it enters the viewport.</p>
</header>

<section class="reveal"><h2>01 — Observe</h2><p>One observer watches every block, so the cost doesn't grow with the page.</p></section>
<section class="reveal"><h2>02 — Unobserve</h2><p>Blocks stop being watched once they've played, so nothing replays on the way back up.</p></section>
<section class="reveal"><h2>03 — Respect</h2><p>The animation is skipped entirely when the visitor prefers reduced motion.</p></section>
<section class="reveal"><h2>04 — Ship</h2><p>No library, about fifteen lines of JavaScript.</p></section>`,
    css: `body {
  margin: 0;
  padding: 0 1.5rem 40vh;
  background: #08100d;
  color: #e7f3ee;
  font-family: system-ui, sans-serif;
}

header {
  display: grid;
  place-content: center;
  min-height: 70vh;
  max-width: 44rem;
  margin: 0 auto;
  text-align: center;
}

h1 { margin: 0 0 0.75rem; font-size: clamp(2.4rem, 9vw, 4rem); letter-spacing: -0.04em; }
header p { margin: 0; color: #7fa093; }

.reveal {
  max-width: 44rem;
  margin: 0 auto 6rem;
  padding: 2rem;
  border-radius: 1rem;
  border: 1px solid rgb(52 211 153 / 18%);
  background: #0d1714;
  opacity: 0;
  transform: translateY(28px);
  transition: opacity 0.7s ease, transform 0.7s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.reveal.is-visible { opacity: 1; transform: none; }

h2 { margin: 0 0 0.5rem; color: #34d399; font-size: 1.35rem; }
.reveal p { margin: 0; color: rgb(231 243 238 / 70%); line-height: 1.7; }

@media (prefers-reduced-motion: reduce) {
  .reveal { opacity: 1; transform: none; transition: none; }
}`,
    js: `const blocks = document.querySelectorAll('.reveal')

const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue
    entry.target.classList.add('is-visible')
    observer.unobserve(entry.target)
  }
}, { threshold: 0.25 })

blocks.forEach((block) => observer.observe(block))
console.log('Watching', blocks.length, 'blocks')`,
  },

  {
    id: "todo",
    name: "Todo app",
    blurb: "State, rendering and event delegation in vanilla JS",
    html: `<main>
  <h1>Today</h1>

  <form id="form">
    <input id="input" placeholder="What needs doing?" autocomplete="off">
    <button type="submit">Add</button>
  </form>

  <ul id="list"></ul>
  <p id="count"></p>
</main>`,
    css: `body {
  margin: 0;
  display: grid;
  place-items: start center;
  min-height: 100vh;
  padding: 4rem 1.5rem;
  background: #0b0f0e;
  color: #e8f2ee;
  font-family: system-ui, sans-serif;
}

main { width: min(30rem, 100%); }
h1 { margin: 0 0 1.5rem; font-size: 2rem; letter-spacing: -0.03em; }

form { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }

input {
  flex: 1;
  padding: 0.75rem 0.9rem;
  border: 1px solid #24352f;
  border-radius: 0.6rem;
  background: #101917;
  color: inherit;
  font-size: 0.95rem;
  outline: none;
}

input:focus { border-color: #34d399; }

button {
  padding: 0 1.1rem;
  border: 0;
  border-radius: 0.6rem;
  background: #34d399;
  color: #04140f;
  font-weight: 700;
  cursor: pointer;
}

ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }

li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0.9rem;
  border-radius: 0.6rem;
  background: #101917;
  cursor: pointer;
}

li.done { color: #5f776f; text-decoration: line-through; }

li .dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  background: #34d399;
  flex: none;
}

li.done .dot { background: #2b3a35; }

li .remove { margin-left: auto; opacity: 0.4; }
li:hover .remove { opacity: 1; }

#count { color: #5f776f; font-size: 0.85rem; }`,
    js: `const form = document.getElementById('form')
const input = document.getElementById('input')
const list = document.getElementById('list')
const count = document.getElementById('count')

let todos = [
  { id: 1, text: 'Open the console tab', done: true },
  { id: 2, text: 'Click a task to complete it', done: false },
]

function render() {
  list.innerHTML = ''

  for (const todo of todos) {
    const li = document.createElement('li')
    li.dataset.id = todo.id
    li.className = todo.done ? 'done' : ''
    li.innerHTML =
      '<span class="dot"></span><span>' + todo.text + '</span>' +
      '<span class="remove" data-action="remove">x</span>'
    list.appendChild(li)
  }

  const left = todos.filter((t) => !t.done).length
  count.textContent = left + ' of ' + todos.length + ' remaining'
}

form.addEventListener('submit', (event) => {
  event.preventDefault()
  const text = input.value.trim()
  if (!text) return

  todos.push({ id: Date.now(), text, done: false })
  input.value = ''
  render()
})

// One listener for the whole list — rows come and go, delegation doesn't care.
list.addEventListener('click', (event) => {
  const li = event.target.closest('li')
  if (!li) return

  const id = Number(li.dataset.id)
  if (event.target.dataset.action === 'remove') {
    todos = todos.filter((t) => t.id !== id)
  } else {
    todos = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
  }
  render()
})

render()`,
  },
];

export const TEMPLATE_BY_ID = new Map(SKETCH_TEMPLATES.map((t) => [t.id, t]));
