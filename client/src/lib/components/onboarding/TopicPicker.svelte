<!--
	Pick textbook chapters, grouped by subject / year / course.
	Submits as repeated hidden inputs: name="topicIds" value=<id>.
-->
<script lang="ts">
	import type { CurriculumGroup } from '$lib/types/onboarding';

	let {
		groups,
		selected = $bindable([]),
		name = 'topicIds',
		searchable = false,
		emptyMessage = 'No chapters available yet.'
	}: {
		groups: CurriculumGroup[];
		selected?: string[];
		name?: string;
		searchable?: boolean;
		emptyMessage?: string;
	} = $props();

	let query = $state('');
	let open = $state<Record<string, boolean>>({});

	const selectedSet = $derived(new Set(selected));

	const visibleGroups = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return groups;
		return groups.filter(
			(g) =>
				label(g).toLowerCase().includes(q) ||
				g.topics.some((t) => t.title.toLowerCase().includes(q))
		);
	});

	function label(g: CurriculumGroup) {
		return `Year ${g.yearLevel} ${g.course ?? g.subject}`;
	}

	function countIn(g: CurriculumGroup) {
		return g.topics.reduce((n, t) => n + (selectedSet.has(t.id) ? 1 : 0), 0);
	}

	function toggleTopic(id: string) {
		selected = selectedSet.has(id) ? selected.filter((s) => s !== id) : [...selected, id];
	}

	function toggleGroup(g: CurriculumGroup) {
		const ids = g.topics.map((t) => t.id);
		if (countIn(g) === ids.length) {
			const remove = new Set(ids);
			selected = selected.filter((s) => !remove.has(s));
		} else {
			selected = [...new Set([...selected, ...ids])];
			open[g.key] = true;
		}
	}

	// sets the indeterminate state on the group checkbox
	function indeterminate(node: HTMLInputElement, value: boolean) {
		node.indeterminate = value;
		return {
			update(v: boolean) {
				node.indeterminate = v;
			}
		};
	}
</script>

<div class="picker">
	{#each selected as id (id)}
		<input type="hidden" {name} value={id} />
	{/each}

	{#if searchable && groups.length > 3}
		<input
			class="search"
			type="search"
			placeholder="Search subjects or chapters"
			bind:value={query}
			aria-label="Search subjects or chapters"
		/>
	{/if}

	{#if groups.length === 0}
		<p class="empty">{emptyMessage}</p>
	{:else if visibleGroups.length === 0}
		<p class="empty">Nothing matches “{query}”.</p>
	{/if}

	<ul class="groups">
		{#each visibleGroups as g (g.key)}
			{@const count = countIn(g)}
			{@const isOpen = open[g.key] || !!query.trim()}
			<li class="group" class:has-selection={count > 0}>
				<div class="group-head">
					<label class="check">
						<input
							type="checkbox"
							checked={count === g.topics.length && count > 0}
							use:indeterminate={count > 0 && count < g.topics.length}
							onchange={() => toggleGroup(g)}
							aria-label="Select all chapters in {label(g)}"
						/>
					</label>
					<button
						type="button"
						class="group-toggle"
						aria-expanded={isOpen}
						onclick={() => (open[g.key] = !open[g.key])}
					>
						<span class="group-name">{label(g)}</span>
						<span class="group-count">
							{count > 0 ? `${count} of ${g.topics.length}` : `${g.topics.length} chapters`}
						</span>
						<svg class="chevron" class:rotated={isOpen} viewBox="0 0 16 16" aria-hidden="true">
							<path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" />
						</svg>
					</button>
				</div>

				{#if isOpen}
					<ul class="topics">
						{#each g.topics as t (t.id)}
							<li>
								<label class="topic">
									<input
										type="checkbox"
										checked={selectedSet.has(t.id)}
										onchange={() => toggleTopic(t.id)}
									/>
									<span class="chapter">Ch {t.chapter}</span>
									<span class="topic-title">{t.title}</span>
								</label>
							</li>
						{/each}
					</ul>
				{/if}
			</li>
		{/each}
	</ul>
</div>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.search {
		font: inherit;
		padding: 0.5rem 0.625rem;
		border: 1px solid #eaeaea;
		border-radius: 6px;

		&:focus-visible {
			outline: none;
			border-color: #000;
			box-shadow: 0 0 0 1px #000;
		}
	}

	.empty {
		color: #666;
		margin: 0;
	}

	.groups,
	.topics {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.groups {
		border: 1px solid #eaeaea;
		border-radius: 6px;
		max-height: 24rem;
		overflow-y: auto;
	}

	.group + .group {
		border-top: 1px solid #eaeaea;
	}

	.group-head {
		display: flex;
		align-items: center;
	}

	.check {
		display: grid;
		place-items: center;
		padding: 0.625rem 0 0.625rem 0.75rem;
		cursor: pointer;
	}

	.group-toggle {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font: inherit;
		background: none;
		border: none;
		padding: 0.625rem 0.75rem;
		cursor: pointer;
		text-align: left;
		color: #000;
		min-width: 0;
	}

	.group-name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.group-count {
		color: #666;
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
	}

	.has-selection .group-count {
		color: #000;
	}

	.chevron {
		width: 0.875rem;
		height: 0.875rem;
		color: #999;
		transition: transform 150ms ease;
		flex-shrink: 0;

		&.rotated {
			transform: rotate(180deg);
		}
	}

	.topics {
		padding-block-end: 0.375rem;
	}

	.topic {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		padding: 0.375rem 0.75rem 0.375rem 2.25rem;
		cursor: pointer;

		&:hover {
			background: #fafafa;
		}

		& input {
			align-self: center;
		}
	}

	.chapter {
		color: #999;
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
		min-width: 2.5rem;
	}

	.topic-title {
		flex: 1;
	}

	input[type='checkbox'] {
		accent-color: #000;
		margin: 0;
	}
</style>
