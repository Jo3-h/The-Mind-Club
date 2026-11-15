<script lang="ts">
	import type { SVGAttributes } from 'svelte/elements';
	import { icons, type IconName } from '$lib/icons/paths';

	interface Props extends SVGAttributes<SVGSVGElement> {
		icon: IconName;
		size?: string;
		label?: string;
	}

	let { icon, size = '1em', label, ...rest }: Props = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
	{...rest}
>
	{@html icons[icon]}
</svg>
