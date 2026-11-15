<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Alert from '$lib/components/basic/Alert.svelte';
	import Button from '$lib/components/basic/Button.svelte';
	import DataTable, { type Column } from '$lib/components/basic/DataTable.svelte';
	import Input from '$lib/components/basic/Input.svelte';
	import Select from '$lib/components/basic/Select.svelte';
	import Icon from '$lib/components/branding/Icon.svelte';
	import { STATES, YEAR_LEVELS } from '$lib/constants/profile';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();

	type FormError = { message?: string };
	type LinkItem = (typeof data.links)[number];

	const TIMEZONE = 'Australia/Adelaide';
	const dateFormat = new Intl.DateTimeFormat('en-AU', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: TIMEZONE
	});

	function pagesLabel(start: number | null, end: number | null) {
		if (start !== null && end !== null)
			return start === end ? `p. ${start}` : `pp. ${start}–${end}`;
		if (start !== null) return `from p. ${start}`;
		if (end !== null) return `to p. ${end}`;
		return null;
	}
	/** Number inputs bind to number | null | undefined; send '' for empty so the server reads null. */
	const numberField = (n: number | null | undefined) => (n === null || n === undefined ? '' : n);

	const nextChapter = $derived(
		data.links.reduce((max, l) => Math.max(max, l.link.chapterNumber), 0) + 1
	);
	const duplicateChapters = $derived.by(() => {
		const seen: Record<number, number> = {};
		for (const l of data.links) seen[l.link.chapterNumber] = (seen[l.link.chapterNumber] ?? 0) + 1;
		return Object.entries(seen)
			.filter(([, n]) => n > 1)
			.map(([chapter]) => Number(chapter));
	});

	// ---------- Course details editing ----------
	let isEditingCourse = $state(false);
	let isSavingCourse = $state(false);
	let courseError: string | null = $state(null);
	let editName = $state('');
	let editKey = $state('');
	let editSubjectId = $state('');
	let editYearLevel: number = $state(YEAR_LEVELS[0]);
	/** '' = National (applies in every state) */
	let editState: string = $state('');
	let editTextbook = $state('');
	function startEditingCourse() {
		stopEditingLink();
		stopAdding();
		editName = data.course.name;
		editKey = data.course.key;
		editSubjectId = data.course.subjectId;
		editYearLevel = data.course.yearLevel;
		editState = data.course.state ?? '';
		editTextbook = data.course.textbook ?? '';
		courseError = null;
		isEditingCourse = true;
	}
	function stopEditingCourse() {
		isEditingCourse = false;
		courseError = null;
	}

	// ---------- Topic table ----------
	const columns: Column[] = [
		{ label: 'Chapter', key: 'chapter', width: '6rem', align: 'center', sortable: true },
		{ label: 'Topic', key: 'topic', width: '16rem', sortable: true },
		{ label: 'Chapter title', key: 'chapter-title' },
		{ label: 'Pages', key: 'pages', width: '10rem' },
		{ label: 'Notes', key: 'notes' },
		{ label: '', key: 'actions', width: '7.5rem' }
	];

	// sorting
	let sortKey: string = $state('chapter');
	let sortOrder: 'asc' | 'desc' = $state('asc');
	function onSort(key: string) {
		if (sortKey === key) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortOrder = 'asc';
		}
	}
	function getSortValue(row: LinkItem, key: string): string | number | null {
		if (key === 'topic') return row.topic.title;
		return row.link.chapterNumber;
	}
	const sortedLinks = $derived.by(() => {
		return [...data.links].sort((a, b) => {
			const aValue = getSortValue(a, sortKey);
			const bValue = getSortValue(b, sortKey);

			if (aValue === bValue) return 0;
			if (aValue === null) return sortOrder === 'asc' ? -1 : 1;
			if (bValue === null) return sortOrder === 'asc' ? 1 : -1;

			if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
			return sortOrder === 'asc' ? 1 : -1;
		});
	});

	// editing a topic link
	let editingTopicId: string | null = $state(null);
	const isEditingLink = $derived(editingTopicId !== null);
	let isSavingLink = $state(false);
	let linkError: string | null = $state(null);
	let editChapter: number | null = $state(null);
	let editChapterTitle = $state('');
	let editPageStart: number | null = $state(null);
	let editPageEnd: number | null = $state(null);
	let editNotes = $state('');
	function startEditingLink(item: LinkItem) {
		stopEditingCourse();
		stopAdding();
		editingTopicId = item.topic.id;
		editChapter = item.link.chapterNumber;
		editChapterTitle = item.link.chapterTitle ?? '';
		editPageStart = item.link.pageStart;
		editPageEnd = item.link.pageEnd;
		editNotes = item.link.notes ?? '';
		linkError = null;
	}
	function stopEditingLink() {
		editingTopicId = null;
		linkError = null;
	}

	// removing a topic
	let isRemoving = $state(false);
	let removeError: string | null = $state(null);

	// adding a topic
	let isAddActive = $state(false);
	let isAdding = $state(false);
	let addError: string | null = $state(null);
	let addTopicId = $state('');
	let addChapter: number | null = $state(null);
	let addChapterTitle = $state('');
	let addPageStart: number | null = $state(null);
	let addPageEnd: number | null = $state(null);
	let addNotes = $state('');
	function startAdding() {
		stopEditingCourse();
		stopEditingLink();
		addTopicId = data.availableTopics[0]?.id ?? '';
		addChapter = nextChapter;
		addChapterTitle = '';
		addPageStart = null;
		addPageEnd = null;
		addNotes = '';
		addError = null;
		isAddActive = true;
	}
	function stopAdding() {
		isAddActive = false;
		addError = null;
	}

	const isBusy = $derived(isEditingCourse || isEditingLink || isAddActive);
</script>

<svelte:head>
	<title>Admin - {data.course.name}</title>
</svelte:head>

<div class="page">
	<a class="back" href={resolve('/admin/courses')}>← Courses</a>

	<header class="page-header">
		<div>
			<h1>{data.course.name}</h1>
			<p class="subtitle">
				Year {data.course.yearLevel}
				{data.course.state ?? 'National'} · {data.course.subjectName} ·
				{#if data.course.isActive}Active{:else}Hidden{/if}
			</p>
		</div>
		<span class="count">
			{data.links.length}
			{data.links.length === 1 ? 'topic' : 'topics'}
		</span>
	</header>

	{#if courseError || linkError || removeError || addError}
		<div class="alerts">
			{#if courseError}
				<Alert variant="error" title="Update Error">
					<div class="pre">{courseError.trimStart()}</div>
				</Alert>
			{/if}
			{#if linkError}
				<Alert variant="error" title="Update Error">
					<div class="pre">{linkError.trimStart()}</div>
				</Alert>
			{/if}
			{#if removeError}
				<Alert variant="error" title="Remove Error">
					<div class="pre">{removeError.trimStart()}</div>
				</Alert>
			{/if}
			{#if addError}
				<Alert variant="error" title="Add Error">
					<div class="pre">{addError.trimStart()}</div>
				</Alert>
			{/if}
		</div>
	{/if}

	<!-- Course details -->
	<section class="panel" class:editing={isEditingCourse}>
		<div class="panel-header">
			<h2>Details</h2>
			<div class="panel-actions">
				{#if isEditingCourse}
					<form
						method="POST"
						action="?/updateCourse"
						use:enhance={() => {
							courseError = null;
							isSavingCourse = true;
							return async ({ result, update }) => {
								isSavingCourse = false;
								if (result.type === 'failure') {
									courseError = (result.data as FormError)?.message ?? 'Could not save';
									return;
								}
								if (result.type === 'error') {
									courseError = (result.error as FormError)?.message ?? 'An error occurred';
									return;
								}
								stopEditingCourse();
								await update();
							};
						}}
					>
						<input type="hidden" name="name" value={editName} />
						<input type="hidden" name="key" value={editKey} />
						<input type="hidden" name="subjectId" value={editSubjectId} />
						<input type="hidden" name="yearLevel" value={editYearLevel} />
						<input type="hidden" name="state" value={editState} />
						<input type="hidden" name="textbook" value={editTextbook} />
						<Button directive="success" aria-label="Save course" disabled={isSavingCourse}>
							<Icon icon="check" />
						</Button>
					</form>
					<Button
						directive="danger"
						aria-label="Cancel editing"
						onclick={stopEditingCourse}
						disabled={isSavingCourse}
					>
						<Icon icon="cross" />
					</Button>
				{:else}
					<Button
						directive="warning"
						aria-label="Edit course"
						onclick={startEditingCourse}
						disabled={isBusy}
					>
						<Icon icon="edit" />
					</Button>
				{/if}
			</div>
		</div>

		<dl class="details">
			<div>
				<dt>Name</dt>
				<dd>
					{#if isEditingCourse}
						<Input
							bind:value={editName}
							aria-label="Course name"
							onkeydown={(e) => e.key === 'Escape' && stopEditingCourse()}
						/>
					{:else}
						{data.course.name}
					{/if}
				</dd>
			</div>
			<div>
				<dt>Key</dt>
				<dd>
					{#if isEditingCourse}
						<Input
							mono
							bind:value={editKey}
							aria-label="Course key"
							onkeydown={(e) => e.key === 'Escape' && stopEditingCourse()}
						/>
					{:else}
						<span class="key-pill">{data.course.key}</span>
					{/if}
				</dd>
			</div>
			<div>
				<dt>Subject</dt>
				<dd>
					{#if isEditingCourse}
						<Select
							bind:value={editSubjectId}
							aria-label="Course subject"
							disabled={data.links.length > 0}
							title={data.links.length > 0
								? 'Remove all topics from this course to change the subject'
								: undefined}
						>
							{#each data.subjects as subject (subject.id)}
								<option value={subject.id}>{subject.name}</option>
							{/each}
						</Select>
					{:else}
						{data.course.subjectName}
					{/if}
				</dd>
			</div>
			<div>
				<dt>Year level</dt>
				<dd>
					{#if isEditingCourse}
						<Select bind:value={editYearLevel} aria-label="Course year level">
							{#each YEAR_LEVELS as year (year)}
								<option value={year}>Year {year}</option>
							{/each}
						</Select>
					{:else}
						Year {data.course.yearLevel}
					{/if}
				</dd>
			</div>
			<div>
				<dt>State</dt>
				<dd>
					{#if isEditingCourse}
						<Select bind:value={editState} aria-label="Course state">
							<option value="">National</option>
							{#each STATES as state (state)}
								<option value={state}>{state}</option>
							{/each}
						</Select>
					{:else}
						{data.course.state ?? 'National'}
					{/if}
				</dd>
			</div>
			<div class="wide">
				<dt>Textbook</dt>
				<dd>
					{#if isEditingCourse}
						<Input
							bind:value={editTextbook}
							placeholder="e.g. Cambridge Senior Maths: Mathematical Methods Units 1&2"
							aria-label="Course textbook"
							onkeydown={(e) => e.key === 'Escape' && stopEditingCourse()}
						/>
					{:else if data.course.textbook}
						{data.course.textbook}
					{:else}
						<span class="muted">No textbook set</span>
					{/if}
				</dd>
			</div>
			<div>
				<dt>Created</dt>
				<dd class="muted">{dateFormat.format(data.course.createdAt)}</dd>
			</div>
			<div>
				<dt>Updated</dt>
				<dd class="muted">{dateFormat.format(data.course.updatedAt)}</dd>
			</div>
		</dl>
	</section>

	<!-- Topics in this course -->
	<section class="section">
		<div class="section-header">
			<h2>Topics</h2>
			<p class="subtitle">
				The chapters in this course, in order, and where to find each one in the textbook.
			</p>
		</div>

		{#if duplicateChapters.length > 0}
			<Alert variant="warning" title="Duplicate chapters">
				More than one topic uses chapter {duplicateChapters.join(', ')}.
			</Alert>
		{/if}

		<DataTable
			{columns}
			rows={sortedLinks}
			getKey={(l) => l.topic.id}
			emptyText="This course has no topics yet."
			{sortKey}
			{sortOrder}
			{onSort}
		>
			{#snippet row(item)}
				{#if editingTopicId === item.topic.id}
					<tr class="editing">
						<td>
							<Input
								type="number"
								min="1"
								step="1"
								bind:value={editChapter}
								aria-label="Chapter number"
								onkeydown={(e) => e.key === 'Escape' && stopEditingLink()}
							/>
						</td>
						<td class="cell-primary" title={item.topic.title}>{item.topic.title}</td>
						<td>
							<Input
								bind:value={editChapterTitle}
								placeholder="Same as topic"
								aria-label="Chapter title"
								onkeydown={(e) => e.key === 'Escape' && stopEditingLink()}
							/>
						</td>
						<td>
							<div class="page-range">
								<Input
									type="number"
									min="1"
									step="1"
									bind:value={editPageStart}
									placeholder="From"
									aria-label="Start page"
									onkeydown={(e) => e.key === 'Escape' && stopEditingLink()}
								/>
								<Input
									type="number"
									min="1"
									step="1"
									bind:value={editPageEnd}
									placeholder="To"
									aria-label="End page"
									onkeydown={(e) => e.key === 'Escape' && stopEditingLink()}
								/>
							</div>
						</td>
						<td>
							<Input
								bind:value={editNotes}
								placeholder="Notes"
								aria-label="Notes"
								onkeydown={(e) => e.key === 'Escape' && stopEditingLink()}
							/>
						</td>
						<td>
							<div class="actions always">
								<form
									method="POST"
									action="?/updateTopicLink"
									use:enhance={() => {
										linkError = null;
										isSavingLink = true;
										return async ({ result, update }) => {
											isSavingLink = false;
											if (result.type === 'failure') {
												linkError = (result.data as FormError)?.message ?? 'Could not save';
												return;
											}
											if (result.type === 'error') {
												linkError = (result.error as FormError)?.message ?? 'An error occurred';
												return;
											}
											stopEditingLink();
											await update();
										};
									}}
								>
									<input type="hidden" name="topicId" value={item.topic.id} />
									<input type="hidden" name="chapterNumber" value={numberField(editChapter)} />
									<input type="hidden" name="chapterTitle" value={editChapterTitle} />
									<input type="hidden" name="pageStart" value={numberField(editPageStart)} />
									<input type="hidden" name="pageEnd" value={numberField(editPageEnd)} />
									<input type="hidden" name="notes" value={editNotes} />
									<Button
										directive="success"
										aria-label="Save chapter reference"
										disabled={isSavingLink || numberField(editChapter) === ''}
									>
										<Icon icon="check" />
									</Button>
								</form>
								<Button
									directive="danger"
									aria-label="Cancel editing"
									onclick={stopEditingLink}
									disabled={isSavingLink}
								>
									<Icon icon="cross" />
								</Button>
							</div>
						</td>
					</tr>
				{:else}
					<tr class:dimmed={isEditingLink}>
						<td class="center" class:warn={duplicateChapters.includes(item.link.chapterNumber)}>
							{item.link.chapterNumber}
						</td>
						<td class="cell-primary" title={item.topic.title}>
							<a class="row-link" href={resolve(`/admin/topics/${item.topic.id}`)}>
								{item.topic.title}
							</a>
						</td>
						<td title={item.link.chapterTitle ?? undefined}>
							{#if item.link.chapterTitle}{item.link.chapterTitle}{:else}<span class="muted">—</span
								>{/if}
						</td>
						<td>
							{pagesLabel(item.link.pageStart, item.link.pageEnd) ?? '—'}
						</td>
						<td title={item.link.notes ?? undefined}>
							{#if item.link.notes}{item.link.notes}{:else}<span class="muted">—</span>{/if}
						</td>
						<td>
							<div class="actions">
								<Button
									directive="warning"
									aria-label="Edit chapter reference"
									onclick={() => startEditingLink(item)}
									disabled={isBusy}
								>
									<Icon icon="edit" />
								</Button>
								<form
									method="POST"
									action="?/removeTopic"
									use:enhance={() => {
										removeError = null;
										isRemoving = true;
										return async ({ result, update }) => {
											isRemoving = false;
											if (result.type === 'failure') {
												removeError = (result.data as FormError)?.message ?? 'Could not remove';
												return;
											}
											if (result.type === 'error') {
												removeError = (result.error as FormError)?.message ?? 'An error occurred';
												return;
											}
											await update();
										};
									}}
								>
									<input type="hidden" name="topicId" value={item.topic.id} />
									<Button
										directive="danger"
										aria-label="Remove from course"
										disabled={isBusy || isRemoving}
									>
										<Icon icon="cross" />
									</Button>
								</form>
							</div>
						</td>
					</tr>
				{/if}
			{/snippet}
			{#snippet footer()}
				{#if !isAddActive}
					<tr>
						<td colspan={columns.length}>
							{#if data.availableTopics.length > 0}
								<Button
									directive="success"
									aria-label="Add a topic"
									onclick={startAdding}
									disabled={isBusy}
								>
									<Icon icon="plus" />
								</Button>
							{:else}
								<span class="muted">
									Every {data.course.subjectName} topic is already in this course.
								</span>
							{/if}
						</td>
					</tr>
				{:else}
					<tr class="editing">
						<td>
							<Input
								type="number"
								min="1"
								step="1"
								bind:value={addChapter}
								placeholder="#"
								aria-label="Chapter number"
								onkeydown={(e) => e.key === 'Escape' && stopAdding()}
							/>
						</td>
						<td>
							<Select
								bind:value={addTopicId}
								aria-label="Topic"
								onkeydown={(e) => e.key === 'Escape' && stopAdding()}
							>
								{#each data.availableTopics as topic (topic.id)}
									<option value={topic.id}>{topic.title}</option>
								{/each}
							</Select>
						</td>
						<td>
							<Input
								bind:value={addChapterTitle}
								placeholder="Same as topic"
								aria-label="Chapter title"
								onkeydown={(e) => e.key === 'Escape' && stopAdding()}
							/>
						</td>
						<td>
							<div class="page-range">
								<Input
									type="number"
									min="1"
									step="1"
									bind:value={addPageStart}
									placeholder="From"
									aria-label="Start page"
									onkeydown={(e) => e.key === 'Escape' && stopAdding()}
								/>
								<Input
									type="number"
									min="1"
									step="1"
									bind:value={addPageEnd}
									placeholder="To"
									aria-label="End page"
									onkeydown={(e) => e.key === 'Escape' && stopAdding()}
								/>
							</div>
						</td>
						<td>
							<Input
								bind:value={addNotes}
								placeholder="Notes"
								aria-label="Notes"
								onkeydown={(e) => e.key === 'Escape' && stopAdding()}
							/>
						</td>
						<td>
							<div class="actions always">
								<form
									method="POST"
									action="?/addTopic"
									use:enhance={() => {
										addError = null;
										isAdding = true;
										return async ({ result, update }) => {
											isAdding = false;
											if (result.type === 'failure') {
												addError = (result.data as FormError)?.message ?? 'Could not add';
												return;
											}
											if (result.type === 'error') {
												addError = (result.error as FormError)?.message ?? 'An error occurred';
												return;
											}
											stopAdding();
											await update();
										};
									}}
								>
									<input type="hidden" name="topicId" value={addTopicId} />
									<input type="hidden" name="chapterNumber" value={numberField(addChapter)} />
									<input type="hidden" name="chapterTitle" value={addChapterTitle} />
									<input type="hidden" name="pageStart" value={numberField(addPageStart)} />
									<input type="hidden" name="pageEnd" value={numberField(addPageEnd)} />
									<input type="hidden" name="notes" value={addNotes} />
									<Button
										directive="success"
										aria-label="Add topic"
										disabled={isAdding || !addTopicId || numberField(addChapter) === ''}
									>
										<Icon icon="check" />
									</Button>
								</form>
								<Button
									directive="danger"
									aria-label="Cancel"
									onclick={stopAdding}
									disabled={isAdding}
								>
									<Icon icon="cross" />
								</Button>
							</div>
						</td>
					</tr>
				{/if}
			{/snippet}
		</DataTable>
	</section>
</div>

<style>
	.page {
		padding: var(--gap-large);
		display: flex;
		flex-direction: column;
		gap: var(--gap-large);
		min-width: 0;
		flex: 1;
	}

	.back {
		align-self: flex-start;
		font-size: 0.8125rem;
		color: hsl(210, 8%, 45%);
		text-decoration: none;

		&:hover {
			color: inherit;
			text-decoration: underline;
		}
	}

	.page-header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;

		h1 {
			margin: 0;
			font-family: 'Source Serif 4', serif;
			font-size: var(--text-large);
			font-weight: 600;
			letter-spacing: -0.01em;
		}
	}

	h2 {
		margin: 0;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: hsl(210, 8%, 45%);
	}

	.subtitle {
		margin: 0.25rem 0 0;
		font-size: 0.875rem;
		color: hsl(210, 8%, 45%);
	}

	.count {
		flex-shrink: 0;
		font-size: 0.8125rem;
		color: hsl(210, 8%, 45%);
		font-variant-numeric: tabular-nums;
	}

	.alerts {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.pre {
		white-space: pre-line;
	}

	.muted {
		color: hsl(210, 8%, 45%);
	}

	/* Course details panel: flat, hairline border, same surface as DataTable */
	.panel {
		border: 1px solid var(--grey);
		border-radius: 8px;
		background: #fff;
		font-size: 0.875rem;

		&.editing {
			box-shadow: inset 3px 0 0 var(--orange);
			background: color-mix(in srgb, var(--orange) 6%, #fff);
		}
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 1rem;
		border-bottom: 1px solid var(--grey);
		min-height: 2.5rem;
	}

	.panel-actions {
		display: flex;
		gap: 0.375rem;

		form {
			display: flex;
		}
	}

	.details {
		margin: 0;
		padding: 0.75rem 1rem;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: 0.75rem 1.5rem;

		.wide {
			grid-column: 1 / -1;
		}

		dt {
			font-size: 0.75rem;
			color: hsl(210, 8%, 45%);
			margin-bottom: 0.25rem;
		}

		dd {
			margin: 0;
			min-height: 2rem;
			display: flex;
			align-items: center;
		}
	}

	.key-pill {
		display: inline-block;
		padding: 0.125rem 0.5rem;
		border: 1px solid var(--grey);
		border-radius: 4px;
		background: hsl(210, 20%, 98%);
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 0.75rem;
		color: hsl(210, 8%, 45%);
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.page-range {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.375rem;
	}

	.row-link {
		color: inherit;
		text-decoration: none;

		&:hover {
			text-decoration: underline;
		}
	}

	.warn {
		font-weight: 600;
		color: hsl(0, 60%, 45%);
	}
</style>
