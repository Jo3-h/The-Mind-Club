<script lang="ts">
	interface Props {
		size?: string;
	}
	const { size = 'clamp(9rem, 24vw, 15rem)' }: Props = $props();

	let el: HTMLDivElement;

	// Cursor position relative to the icon's centre, normalised to -1..1
	let x = $state(0);
	let y = $state(0);
	// True when the cursor is close to the icon
	let active = $state(false);

	let frame = 0;

	function onPointerMove(e: PointerEvent) {
		if (frame) return; // throttle to one update per animation frame
		frame = requestAnimationFrame(() => {
			frame = 0;
			if (!el) return;
			const r = el.getBoundingClientRect();
			const cx = r.left + r.width / 2;
			const cy = r.top + r.height / 2;
			const clamp = (v: number) => Math.max(-1, Math.min(1, v));

			// Normalise against half the viewport so it reacts anywhere on the page
			x = clamp((e.clientX - cx) / (window.innerWidth / 2));
			y = clamp((e.clientY - cy) / (window.innerHeight / 2));
			active = Math.hypot(e.clientX - cx, e.clientY - cy) < r.width;
		});
	}

	function reset() {
		x = 0;
		y = 0;
		active = false;
	}
</script>

<svelte:window
	onpointermove={onPointerMove}
	onpointerup={(e) => e.pointerType !== 'mouse' && reset()}
	onblur={reset}
/>
<svelte:document onmouseout={(e) => !e.relatedTarget && reset()} />

<div class="hero-icon" class:active bind:this={el} style:--x={x} style:--y={y} style:--size={size}>
	<div class="glow" aria-hidden="true"></div>

	<svg
		class="brain"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1"
		stroke-linecap="round"
		stroke-linejoin="round"
		role="img"
		aria-label="MindMates logo"
	>
		<path pathLength="1" style="--i:0" d="M12 18V5" />
		<path pathLength="1" style="--i:1" d="M15 13a4.17 4.17 0 01-3-4 4.17 4.17 0 01-3 4" />
		<path pathLength="1" style="--i:2" d="M17.707 6.294A3 3 0 1012 5a3 3 0 10-5.707 1.294" />
		<path pathLength="1" style="--i:3" d="M17.996 5.125a4 4 0 012.526 5.77" />
		<path pathLength="1" style="--i:4" d="M18 18a4 4 0 002-7.465" />
		<path pathLength="1" style="--i:5" d="M19.967 17.482a4 4 0 11-7.967.517 4 4 0 11-7.967-.517" />
		<path pathLength="1" style="--i:6" d="M6 18a4 4 0 01-2-7.465" />
		<path pathLength="1" style="--i:7" d="M6.004 5.125a4 4 0 00-2.526 5.77" />
	</svg>
</div>

<style>
	.hero-icon {
		/* Glow colours - override from the parent, e.g. <HeroIcon --c1="#10b981" /> */
		--c1: #f97316;
		--c2: #fb7185;
		--c3: #facc15;
		--fg: #fafafa;

		position: relative;
		width: var(--size);
		aspect-ratio: 1;
		display: grid;
		place-items: center;
		perspective: 600px; /* gives the tilt real depth */
	}

	/* ---------- Coloured glow ---------- */
	.glow {
		position: absolute;
		inset: -20%;
		border-radius: 50%;
		background: conic-gradient(from 0deg, var(--c1), var(--c2), var(--c3), var(--c1));
		filter: blur(48px);
		opacity: 0.45;
		pointer-events: none;

		/* Drifts slightly toward the cursor */
		translate: calc(var(--x) * 12%) calc(var(--y) * 12%);
		transition:
			translate 0.8s cubic-bezier(0.2, 0.8, 0.2, 1),
			opacity 0.5s ease;

		/* rotate, scale and translate are separate properties, so these don't fight */
		animation:
			spin 14s linear infinite,
			breathe 6s ease-in-out infinite;
	}

	.active .glow {
		opacity: 0.8;
	}

	/* ---------- Brain ---------- */
	.brain {
		position: relative;
		width: 60%;
		height: 60%;
		color: var(--fg);

		/* Tilts toward the cursor */
		transform: rotateX(calc(var(--y) * -18deg)) rotateY(calc(var(--x) * 18deg));
		transition:
			transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1),
			filter 0.5s ease;
	}

	.active .brain {
		filter: drop-shadow(0 0 6px color-mix(in srgb, var(--c1) 70%, transparent));
	}

	/* Lines draw themselves in on page load, one after another */
	.brain path {
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		animation: draw 1.4s cubic-bezier(0.6, 0, 0.2, 1) forwards;
		animation-delay: calc(var(--i) * 90ms);
	}

	@keyframes spin {
		to {
			rotate: 1turn;
		}
	}
	@keyframes breathe {
		0%,
		100% {
			scale: 1;
		}
		50% {
			scale: 1.1;
		}
	}
	@keyframes draw {
		to {
			stroke-dashoffset: 0;
		}
	}

	/* Respect users who turn off animations */
	@media (prefers-reduced-motion: reduce) {
		.glow,
		.brain path {
			animation: none;
		}
		.brain path {
			stroke-dashoffset: 0;
		}
		.brain {
			transform: none;
		}
		.glow {
			translate: none;
		}
	}
</style>
