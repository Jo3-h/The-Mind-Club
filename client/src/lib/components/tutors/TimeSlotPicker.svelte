<!--
	Coarse weekly time filter: one checkbox per day × slot, submitted as repeated
	`name=<day>-<slot>` values (e.g. when=2-after). Works without JavaScript inside a GET form.
-->
<script lang="ts">
	import { DAYS } from '$lib/constants/onboarding';
	import { TIME_SLOTS } from '$lib/constants/search';
	import { minutesToLabel } from '$lib/utils/time';

	let {
		selected = [],
		name = 'when',
		disabled = false
	}: { selected?: readonly string[]; name?: string; disabled?: boolean } = $props();

	const isSelected = $derived(new Set(selected));
</script>

<div class="slots" class:disabled>
	<table>
		<thead>
			<tr>
				<th scope="col"><span class="sr-only">Time of day</span></th>
				{#each DAYS as d (d.value)}
					<th scope="col"><abbr title={d.long}>{d.short.slice(0, 2)}</abbr></th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each TIME_SLOTS as slot (slot.key)}
				<tr>
					<th scope="row">
						<span class="slot-label">{slot.label}</span>
						<span class="slot-time">{minutesToLabel(slot.start)}–{minutesToLabel(slot.end)}</span>
					</th>
					{#each DAYS as d (d.value)}
						{@const code = `${d.value}-${slot.key}`}
						<td>
							<label class="cell">
								<input
									type="checkbox"
									{name}
									value={code}
									checked={isSelected.has(code)}
									{disabled}
									aria-label="{d.long} {slot.label.toLowerCase()}"
								/>
								<span aria-hidden="true"></span>
							</label>
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.slots {
		overflow-x: auto;

		&.disabled {
			opacity: 0.5;
		}
	}

	table {
		border-collapse: collapse;
		width: 100%;
		font-size: 0.75rem;
	}

	thead th {
		font-weight: 500;
		color: var(--tm-muted);
		padding-bottom: 0.25rem;
		text-align: center;

		abbr {
			text-decoration: none;
		}
	}

	tbody th {
		text-align: left;
		font-weight: 400;
		padding-right: 0.5rem;
		white-space: nowrap;
	}

	.slot-label {
		display: block;
		font-size: 0.65rem;
		color: var(--dark-grey);
	}

	.slot-time {
		display: block;
		color: var(--darkest-grey);
		font-size: var(--text-small);
	}

	td {
		padding: 2px;
	}

	.cell {
		display: block;
		position: relative;
		cursor: pointer;

		input {
			position: absolute;
			opacity: 0;
			inset: 0;
			margin: 0;
			cursor: pointer;
		}

		span {
			display: block;
			height: 1.75rem;
			min-width: 1.75rem;
			border: 1px solid var(--light-grey);
			border-radius: 4px;
			background: #fff;
			transition:
				background 100ms ease,
				border-color 100ms ease;
		}

		input:hover + span {
			border-color: var(--grey);
		}

		input:checked + span {
			background: var(--light-grey);
			border-color: var(--dark-grey);
		}

		input:focus-visible + span {
			outline: 2px solid var(--dark-grey);
			outline-offset: 1px;
		}
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
	}
</style>
