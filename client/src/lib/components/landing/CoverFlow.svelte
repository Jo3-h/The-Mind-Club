<!--
  Cover-flow carousel of open groups.
  The 3D effect is pure CSS: each card runs a keyframe animation against its own
  position in the horizontal scroller (animation-timeline: view(inline)).
  The script only handles the arrow buttons, click-to-centre and keyboard.
  Browsers without scroll timelines (Firefox today) get a plain snap carousel.
-->
<script lang="ts" module>
  export type OpenGroup = {
    id: string;
    subject: 'maths' | 'chem' | 'phys' | 'eng';
    course: string; // "Year 12 Methods (SA)"
    chapter: number;
    topic: string;
    tutor: string;
    when: string; // "Tue 4:00pm · Norwood"
    taken: number;
    capacity: number;
    priceCents: number; // current per-student price
  };
</script>

<script lang="ts">
  import { onMount } from 'svelte';

  let { groups, href = (g: OpenGroup) => `/sessions/${g.id}` }: {
    groups: OpenGroup[];
    href?: (g: OpenGroup) => string;
  } = $props();

  let track: HTMLDivElement;

  const money = (c: number) => (c / 100).toFixed(2);
  const items = () => Array.from(track.children) as HTMLElement[];

  function centre(el: HTMLElement | undefined, behavior: ScrollBehavior = 'smooth') {
    if (!el) return;
    track.scrollTo({ left: el.offsetLeft + el.offsetWidth / 2 - track.clientWidth / 2, behavior });
  }

  function currentIndex() {
    const mid = track.scrollLeft + track.clientWidth / 2;
    let best = 0, bestDist = Infinity;
    items().forEach((el, i) => {
      const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
      if (d < bestDist) { best = i; bestDist = d; }
    });
    return best;
  }

  function step(dir: number) {
    const all = items();
    centre(all[Math.max(0, Math.min(all.length - 1, currentIndex() + dir))]);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  }

  onMount(() => centre(items()[Math.floor(groups.length / 2)], 'instant'));
</script>

<section class="groups" id="groups">
  <div class="wrap head">
    <div>
      <span class="eyebrow">Open groups</span>
      <h2>Groups filling this week</h2>
      <p class="sub">Join one that fits your timetable. Each seat that's taken makes it cheaper for everyone already in it.</p>
    </div>
    <div class="controls">
      <button class="cf-btn" onclick={() => step(-1)} aria-label="Previous group">←</button>
      <button class="cf-btn" onclick={() => step(1)} aria-label="Next group">→</button>
    </div>
  </div>

  <div class="cf">
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div class="track" bind:this={track} role="region" aria-roledescription="carousel" tabindex="0" onkeydown={onKey} aria-label="Open groups, scroll sideways">
      {#each groups as g (g.id)}
        <a
          class="item"
          href={href(g)}
          onclick={(e) => {
            // first click brings a side card forward; clicking the centred card follows the link
            const el = e.currentTarget as HTMLElement;
            const mid = track.scrollLeft + track.clientWidth / 2;
            if (Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid) > 10) { e.preventDefault(); centre(el); }
          }}
          aria-label="{g.topic}, {g.course}, {g.when}, {g.taken} of {g.capacity} seats, ${money(g.priceCents)} per hour"
        >
          <article class="card">
            <div class="cover {g.subject}">
              <span class="course">{g.course}</span>
              <span class="ch">{String(g.chapter).padStart(2, '0')}</span>
              <span class="topic">{g.topic}</span>
            </div>
            <div class="body">
              <div class="who">{g.tutor}</div>
              <div class="when">{g.when}</div>
              <div class="foot">
                <div class="seats">
                  {#each { length: g.capacity } as _, i}
                    <span class="seat" class:on={i < g.taken}></span>
                  {/each}
                </div>
                <div class="p num">${money(g.priceCents)}<small> /hr</small></div>
              </div>
            </div>
          </article>
        </a>
      {/each}
    </div>
    <div class="floor"></div>
  </div>
  <p class="hint">Swipe or scroll sideways · tap a group to bring it forward</p>
</section>

<style>
  .groups { background: radial-gradient(120% 80% at 50% 0%, var(--night-2), var(--night) 70%); color: #e9f0ee; padding: 96px 0 72px; overflow: hidden; }
  .head { display: flex; justify-content: space-between; align-items: end; gap: 24px; flex-wrap: wrap; }
  .eyebrow { color: #8fc2b5; }
  h2 { color: #fff; margin-top: 10px; }
  .sub { color: #9fb2ad; margin-top: 12px; max-width: 46ch; }
  .controls { display: flex; gap: 8px; }
  .cf-btn { width: 44px; height: 44px; border-radius: 50%; border: 1px solid rgb(255 255 255 / 0.16); background: rgb(255 255 255 / 0.04); color: #fff; font-size: 18px; cursor: pointer; }
  .cf-btn:hover { background: rgb(255 255 255 / 0.1); }

  .cf { --card: 280px; position: relative; margin-top: 48px; }
  .track {
    position: relative; display: flex; gap: 24px;
    overflow-x: auto; overscroll-behavior-x: contain; scroll-snap-type: x mandatory; scrollbar-width: none;
    padding: 24px calc(50% - var(--card) / 2) 140px; /* bottom room for reflections */
  }
  .track::-webkit-scrollbar { display: none; }
  .item { flex: 0 0 var(--card); scroll-snap-align: center; text-decoration: none; color: inherit; outline: none; }
  .item:focus-visible .card { outline: 2px solid #8fc2b5; outline-offset: 4px; }

  .card {
    border-radius: var(--radius); overflow: hidden; background: #fff; color: var(--ink);
    box-shadow: 0 30px 60px -20px rgb(0 0 0 / 0.6);
    -webkit-box-reflect: below 6px linear-gradient(transparent 55%, rgb(255 255 255 / 0.22));
  }
  .cover { position: relative; height: 200px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; color: #fff; background: var(--c); }
  .cover::after { content: ''; position: absolute; inset: 0; background: var(--pattern); opacity: 0.35; pointer-events: none; }
  .cover > span { position: relative; z-index: 1; }
  .course { font-size: 12px; font-weight: 500; opacity: 0.85; }
  .ch { font: 600 64px/1 var(--serif); opacity: 0.9; }
  .topic { font: 600 21px/1.15 var(--serif); }

  .maths { --c: linear-gradient(135deg, #1f4d45, #2e6b5f); --pattern: repeating-linear-gradient(0deg, #fff 0 1px, transparent 1px 18px), repeating-linear-gradient(90deg, #fff 0 1px, transparent 1px 18px); }
  .chem { --c: linear-gradient(135deg, #1e4459, #2c6a7a); --pattern: radial-gradient(circle, transparent 9px, #fff 9px 10px, transparent 10px) 0 0 / 28px 28px; }
  .phys { --c: linear-gradient(135deg, #27325c, #3c4e86); --pattern: repeating-radial-gradient(circle at 85% 20%, transparent 0 14px, #fff 14px 15px); }
  .eng { --c: linear-gradient(135deg, #4a2f4f, #6e4a6b); --pattern: repeating-linear-gradient(-45deg, #fff 0 1px, transparent 1px 12px); }

  .body { padding: 14px 16px 16px; }
  .who { font-size: 14px; font-weight: 500; }
  .when { font-size: 13px; color: var(--muted); }
  .foot { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 12px; }
  .foot .seat { width: 18px; height: 18px; }
  .p { font: 600 18px var(--sans); color: var(--amber); white-space: nowrap; }
  .p small { font: 400 11px var(--sans); color: var(--muted); }

  .floor { position: absolute; inset: auto 0 0; height: 160px; background: linear-gradient(transparent, var(--night) 80%); pointer-events: none; }
  .hint { text-align: center; font-size: 13px; color: #7f9893; margin-top: -56px; position: relative; z-index: 2; }

  @media (max-width: 860px) { .cf { --card: 230px; } }

  @supports (animation-timeline: view()) {
    @media (prefers-reduced-motion: no-preference) {
      .track { gap: 0; }
      .item {
        margin-inline: calc(var(--card) * -0.27); /* overlap neighbours */
        animation: cover-flow linear both;
        animation-timeline: view(inline);
      }
      /* 0% = card entering from the right, 50% = centred, 100% = leaving on the left */
      @keyframes cover-flow {
        0%   { transform: perspective(1000px) translateX(-10%) rotateY(58deg) scale(0.78); z-index: 1; filter: brightness(0.55); }
        42%  { transform: perspective(1000px) translateX(-6%) rotateY(52deg) scale(0.82); filter: brightness(0.75); }
        50%  { transform: perspective(1000px) translateZ(60px) rotateY(0) scale(1); z-index: 100; filter: brightness(1); }
        58%  { transform: perspective(1000px) translateX(6%) rotateY(-52deg) scale(0.82); filter: brightness(0.75); }
        100% { transform: perspective(1000px) translateX(10%) rotateY(-58deg) scale(0.78); z-index: 1; filter: brightness(0.55); }
      }
    }
  }
</style>
