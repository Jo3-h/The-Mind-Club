<!--
	Weekly availability painter. Click or drag (mouse or touch) to paint 30-min cells.
	Value is a list of merged windows; submitted as JSON in a hidden input.
-->
<script lang="ts">
	import { DAYS, GRID_START, GRID_END, GRID_STEP } from '$lib/constants/onboarding';
	import type { AvailabilityWindow } from '$lib/types/onboarding';
	import { minutesToLabel, formatWindow, totalMinutes, formatHours } from '$lib/utils/time';

	let {
		value = $bindable([]),
		name = 'availability'
	}: {
		value?: AvailabilityWindow[];
		name?: string;
	} = $props();

	const slotCount = (GRID_END - GRID_START) / GRID_STEP;
	const slots = Array.from({ length: slotCount }, (_, i) => GRID_START + i * GRID_STEP);
	const key = (day: number, start: number) => `${day}:${start}`;

	// seed cells from incoming windows (e.g. restored after a server error)
	let cells = $state(new Set<string>(windowsToKeys(value)));

	// keep the bound value in sync with the painted cells
	$effect(() => {
		value = keysToWindows(cells);
	});

	function windowsToKeys(windows: AvailabilityWindow[]) {
		const out: string[] = [];
		for (const w of windows) {
			for (let m = Math.max(w.start, GRID_START); m < Math.min(w.end, GRID_END); m += GRID_STEP) {
				out.push(key(w.day, m));
			}
		}
		return out;
	}

	function keysToWindows(set: Set<string>): AvailabilityWindow[] {
		const out: AvailabilityWindow[] = [];
		for (const d of DAYS) {
			let open: AvailabilityWindow | null = null;
			for (const s of slots) {
				if (set.has(key(d.value, s))) {
					if (open) open.end = s + GRID_STEP;
					else open = { day: d.value, start: s, end: s + GRID_STEP };
				} else if (open) {
					out.push(open);
					open = null;
				}
			}
			if (open) out.push(open);
		}
		return out;
	}

	// ---- painting ----
	let painting = $state<null | 'add' | 'remove'>(null);

	function apply(k: string) {
		if (!painting) return;
		const has = cells.has(k);
		if (painting === 'add' && !has) cells = new Set(cells).add(k);
		if (painting === 'remove' && has) {
			const next = new Set(cells);
			next.delete(k);
			cells = next;
		}
	}

	function cellKeyAt(x: number, y: number): string | null {
		const el = document.elementFromPoint(x, y) as HTMLElement | null;
		return el?.dataset?.cell ?? null;
	}

	function onPointerDown(e: PointerEvent) {
		const k = (e.target as HTMLElement).dataset?.cell;
		if (!k) return;
		e.preventDefault();
		painting = cells.has(k) ? 'remove' : 'add';
		apply(k);
	}

	function onPointerMove(e: PointerEvent) {
		if (!painting) return;
		const k = cellKeyAt(e.clientX, e.clientY);
		if (k) apply(k);
	}

	function stopPainting() {
		painting = null;
	}

	// keyboard: space/enter toggles the focused cell
	function onKey(e: KeyboardEvent, k: string) {
		if (e.key !== ' ' && e.key !== 'Enter') return;
		e.preventDefault();
		painting = cells.has(k) ? 'remove' : 'add';
		apply(k);
		painting = null;
	}

	// ---- presets ----
	function preset(days: number[], start: number, end: number) {
		const next = new Set(cells);
		for (const d of days) for (let m = start; m < end; m += GRID_STEP) next.add(key(d, m));
		cells = next;
	}

	const presets = [
		{ label: 'Weekday afternoons', run: () => preset([1, 2, 3, 4, 5], 15 * 60 + 30, 18 * 60) },
		{ label: 'Weekday evenings', run: () => preset([1, 2, 3, 4, 5], 18 * 60, 21 * 60) },
		{ label: 'Weekends', run: () => preset([6, 7], 9 * 60, 17 * 60) }
	];

	const total = $derived(totalMinutes(value));
</script>

<svelte:window onpointerup={stopPainting} onpointercancel={stopPainting} />

<div class="availability">
	<input type="hidden" {name} value={JSON.stringify(value)} />

	<div class="presets">
		{#each presets as p (p.label)}
			<button type="button" class="chip" onclick={p.run}>+ {p.label}</button>
		{/each}
		{#if cells.size > 0}
			<button type="button" class="chip clear" onclick={() => (cells = new Set())}>Clear</button>
		{/if}
	</div>

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="grid"
		class:painting={!!painting}
		style:--rows={slotCount}
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		role="grid"
		aria-label="Weekly availability"
		tabindex="-1"
	>
		<div class="corner"></div>
		{#each DAYS as d (d.value)}
			<div class="day-label" role="columnheader">{d.short}</div>
		{/each}

		{#each slots as s (s)}
			<div class="time-label" class:hour={s % 60 === 0}>
				{#if s % 60 === 0}{minutesToLabel(s)}{/if}
			</div>
			{#each DAYS as d (d.value)}
				{@const k = key(d.value, s)}
				<div
					class="cell"
					class:on={cells.has(k)}
					class:hour={s % 60 === 0}
					data-cell={k}
					role="gridcell"
					tabindex="0"
					aria-selected={cells.has(k)}
					aria-label="{d.long} {minutesToLabel(s)}"
					onkeydown={(e) => onKey(e, k)}
				></div>
			{/each}
		{/each}
	</div>

	<div class="summary" aria-live="polite">
		{#if value.length === 0}
			<span class="muted">Tap or drag across the grid to mark when you're free.</span>
		{:else}
			<span class="total">{formatHours(total)} a week</span>
			<div class="windows">
				{#each value as w (`${w.day}-${w.start}`)}
					<span class="window">{formatWindow(w)}</span>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.availability {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.chip {
		font: inherit;
		font-size: 0.75rem;
		padding: 0.25rem 0.625rem;
		border: 1px solid #eaeaea;
		border-radius: 999px;
		background: #fff;
		color: #000;
		cursor: pointer;

		&:hover {
			border-color: #999;
		}

		&.clear {
			color: #666;
		}
	}

	.grid {
		display: grid;
		grid-template-columns: 3rem repeat(7, 1fr);
		grid-template-rows: auto repeat(var(--rows), 0.875rem);
		border: 1px solid #eaeaea;
		border-radius: 6px;
		overflow: hidden;
		user-select: none;
		touch-action: none; /* lets a finger paint instead of scroll */
		max-height: 22rem;
		overflow-y: auto;
		position: relative;
	}

	.corner,
	.day-label {
		position: sticky;
		top: 0;
		background: #fff;
		z-index: 1;
		border-bottom: 1px solid #eaeaea;
	}

	.day-label {
		font-size: 0.6875rem;
		letter-spacing: 0.04em;
		text-align: center;
		padding-block: 0.375rem;
		color: #666;
	}

	.time-label {
		font-size: 0.625rem;
		color: #999;
		padding-inline-end: 0.375rem;
		text-align: right;
		line-height: 1;
		transform: translateY(-0.3rem);

		&.hour {
			border-top: none;
		}
	}

	.cell {
		border-left: 1px solid #f2f2f2;
		cursor: pointer;
		transition: background 80ms ease;

		&.hour {
			border-top: 1px solid #eaeaea;
		}

		&:hover {
			background: #f5f5f5;
		}

		&.on {
			background: #000;
		}

		&.on:hover {
			background: #333;
		}

		&:focus-visible {
			outline: 2px solid #0070f3;
			outline-offset: -2px;
		}
	}

	.painting .cell:hover {
		background: inherit;
	}

	.summary {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		font-size: 0.75rem;
	}

	.muted {
		color: #666;
	}

	.total {
		font-weight: 600;
	}

	.windows {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.window {
		padding: 0.125rem 0.5rem;
		background: #f5f5f5;
		border-radius: 4px;
		font-variant-numeric: tabular-nums;
	}
</style>
