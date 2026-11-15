<!--
  "How pricing works" scrollytelling section.
  The section is 400vh tall with a sticky stage inside. It declares a view timeline
  (--drop) and every animated child reads progress from it, so seats fill, the price
  steps down and the bar shrinks as you scroll — no JS.
  Base styles are the finished state, so unsupported browsers / reduced motion
  just see a full group at the lowest price.

  Expects exactly 4 tiers (the animation ranges are written for 4). Pass your real
  numbers from the pricing_tiers table.
-->
<script lang="ts">
  type Tier = { label: string; students: number; priceCents: number };

  let {
    tiers = [
      { label: 'Just you', students: 1, priceCents: 4800 },
      { label: '2 students', students: 2, priceCents: 3840 },
      { label: '3 students', students: 3, priceCents: 3360 },
      { label: 'Full group of 4', students: 4, priceCents: 3088 }
    ],
    context = 'Year 12 Methods · Ch 3 · Priya N.'
  }: { tiers?: Tier[]; context?: string } = $props();

  const money = (c: number) => (c / 100).toFixed(2);
  const first = $derived(tiers[0].priceCents);
  const last = $derived(tiers[tiers.length - 1].priceCents);
  const saving = $derived(Math.round((1 - last / first) * 100));
  const seatLabels = ['You', 'S', 'K', 'M'];
</script>

<section class="drop" id="pricing" style="--w2:{(tiers[1].priceCents / first) * 100}%; --w3:{(tiers[2].priceCents / first) * 100}%; --w4:{(last / first) * 100}%">
  <div class="wrap stage">
    <div>
      <span class="eyebrow">How pricing works</span>
      <h2>The more students join, the less everyone pays.</h2>
      <p class="sub">The first student books the session. Everyone who joins after them brings the price down, including for the people already in.</p>
      <ol class="steps">
        {#each tiers as t}
          <li class="step"><b>{t.label}</b><span class="num">${money(t.priceCents)} / hr</span></li>
        {/each}
      </ol>
    </div>

    <div class="card">
      <div class="meta">{context}</div>
      <div class="seats">
        {#each seatLabels as s}<span class="seat fill">{s}</span>{/each}
      </div>
      <div class="price-stack">
        {#each tiers as t, i}
          <div>
            <div class="price num">${money(t.priceCents)}</div>
            <div class="g">per student / hr · {i === tiers.length - 1 ? 'group full' : `${t.students} in the group`}</div>
          </div>
        {/each}
      </div>
      <div class="bar"><i></i></div>
      <div class="bar-labels"><span>Price you pay</span><span>Full group saves {saving}%</span></div>
      <p class="cap"><b>Your price can only fall.</b> What you see when you join is the most you'll pay.</p>
    </div>
  </div>
</section>

<style>
  .drop { background: var(--bg); border-block: 1px solid var(--line); }
  .stage { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center; padding-block: 96px; }
  h2 { margin-top: 10px; }
  .sub { color: var(--muted); margin-top: 14px; font-size: 17px; max-width: 40ch; }

  .steps { list-style: none; padding: 0; margin: 32px 0 0; display: grid; gap: 4px; }
  .step { display: flex; justify-content: space-between; padding: 14px 16px; border-radius: 10px; font-size: 15px; --off: 0.4; --shift: 0px; }
  .step b { font-weight: 500; }
  .step span { color: var(--muted); }

  .card { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow-lift); padding: 32px; max-width: 440px; width: 100%; justify-self: center; }
  .seats { gap: 10px; margin-top: 16px; }
  .seat { width: 52px; height: 52px; font-size: 14px; }
  .seat.fill { background: var(--green); border: 0; }

  .price-stack { display: grid; margin-top: 28px; height: 84px; overflow: hidden; }
  .price-stack > div { grid-area: 1 / 1; opacity: 0; --off: 0; --shift: 14px; }
  .price-stack > div:last-child { opacity: 1; }
  .price { font: 600 52px/1 var(--sans); color: var(--amber); }
  .g { font-size: 14px; color: var(--muted); margin-top: 6px; }

  .bar { height: 6px; background: var(--line); border-radius: 3px; margin-top: 20px; overflow: hidden; }
  .bar i { display: block; height: 100%; width: var(--w4); background: var(--amber); border-radius: 3px; }
  .bar-labels { display: flex; justify-content: space-between; font-size: 12px; color: var(--faint); margin-top: 8px; }
  .cap { margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--line); font-size: 14px; color: var(--muted); }
  .cap b { color: var(--ink); font-weight: 500; }

  @media (max-width: 860px) { .stage { grid-template-columns: 1fr; gap: 40px; } }

  @supports (animation-timeline: view()) {
    @media (prefers-reduced-motion: no-preference) {
      .drop { height: 400vh; view-timeline-name: --drop; }
      .stage { position: sticky; top: 0; min-height: 100vh; padding-block: 64px; }

      .step, .price-stack > div, .seat.fill, .bar i {
        animation-timeline: --drop;
        animation-fill-mode: both;
        animation-timing-function: linear;
      }

      /* four overlapping windows across the sticky period */
      .step:nth-child(1), .price-stack > div:nth-child(1) { animation-name: show-first; animation-range: contain 0% contain 28%; }
      .step:nth-child(2), .price-stack > div:nth-child(2) { animation-name: show; animation-range: contain 22% contain 53%; }
      .step:nth-child(3), .price-stack > div:nth-child(3) { animation-name: show; animation-range: contain 47% contain 78%; }
      .step:nth-child(4), .price-stack > div:nth-child(4) { animation-name: show-last; animation-range: contain 72% contain 100%; }

      @keyframes show-first {
        0%, 80% { opacity: 1; transform: none; background: var(--surface); }
        100% { opacity: var(--off); transform: translateY(calc(var(--shift) * -1)); }
      }
      @keyframes show {
        0% { opacity: var(--off); transform: translateY(var(--shift)); }
        20%, 80% { opacity: 1; transform: none; background: var(--surface); }
        100% { opacity: var(--off); transform: translateY(calc(var(--shift) * -1)); }
      }
      @keyframes show-last {
        0% { opacity: var(--off); transform: translateY(var(--shift)); }
        20%, 100% { opacity: 1; transform: none; background: var(--surface); }
      }

      .seat.fill:nth-child(2) { animation-name: seat-in; animation-range: contain 22% contain 28%; }
      .seat.fill:nth-child(3) { animation-name: seat-in; animation-range: contain 47% contain 53%; }
      .seat.fill:nth-child(4) { animation-name: seat-in; animation-range: contain 72% contain 78%; }
      @keyframes seat-in { from { background: transparent; border: 1.5px dashed #c3cbd0; transform: scale(0.85); color: transparent; } }

      .bar i { animation-name: bar; animation-range: contain 0% contain 100%; }
      @keyframes bar {
        0%, 22% { width: 100%; }
        28%, 47% { width: var(--w2); }
        53%, 72% { width: var(--w3); }
        78%, 100% { width: var(--w4); }
      }
    }
  }
</style>
