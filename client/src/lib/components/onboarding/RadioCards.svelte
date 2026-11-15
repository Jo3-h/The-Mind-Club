<script lang="ts" generics="T extends string">
	let {
		options,
		value = $bindable(),
		name
	}: {
		options: { value: T; label: string; hint?: string }[];
		value?: T | '';
		name: string;
	} = $props();
</script>

<div class="cards" role="radiogroup">
	{#each options as o (o.value)}
		<label class="card" class:selected={value === o.value}>
			<input type="radio" {name} value={o.value} bind:group={value} />
			<span class="label">{o.label}</span>
			{#if o.hint}<span class="hint">{o.hint}</span>{/if}
		</label>
	{/each}
</div>

<style>
	.cards {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		padding: 0.625rem 0.75rem;
		border: 1px solid #eaeaea;
		border-radius: 6px;
		cursor: pointer;
		transition: border-color 150ms ease;

		&:hover {
			border-color: #999;
		}

		&.selected {
			border-color: #000;
			box-shadow: 0 0 0 1px #000;
		}

		&:has(input:focus-visible) {
			outline: 2px solid #0070f3;
			outline-offset: 1px;
		}
	}

	input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.label {
		color: #000;
	}

	.hint {
		font-size: 0.75rem;
		color: #666;
	}
</style>
