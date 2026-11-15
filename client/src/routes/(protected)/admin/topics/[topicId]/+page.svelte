<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Alert from '$lib/components/basic/Alert.svelte';
	import Button from '$lib/components/basic/Button.svelte';
	import DataTable, { type Column } from '$lib/components/basic/DataTable.svelte';
	import Input from '$lib/components/basic/Input.svelte';
	import Select from '$lib/components/basic/Select.svelte';
	import Icon from '$lib/components/branding/Icon.svelte';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();

	type FormError = { message?: string };
	type LinkItem = (typeof data.links)[number];
	type CourseItem = LinkItem['course'];

	const TIMEZONE = 'Australia/Adelaide';
	const dateFormat = new Intl.DateTimeFormat('en-AU', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: TIMEZONE
	});

	function courseLabel(course: Pick<CourseItem, 'name' | 'yearLevel' | 'state'>) {
		return `Year ${course.yearLevel} ${course.state ?? 'National'} · ${course.name}`;
	}
	function pagesLabel(start: number | null, end: number | null) {
		if (start !== null && end !== null)
			return start === end ? `p. ${start}` : `pp. ${start}–${end}`;
		if (start !== null) return `from p. ${start}`;
		if (end !== null) return `to p. ${end}`;
		return null;
	}
	/** Number inputs bind to number | null; send '' for null so the server reads it as empty. */
	const numberField = (n: number | null | undefined) => (n === null || n === undefined ? '' : n);

	// ---------- Topic details editing ----------
	let isEditingTopic = $state(false);
	let isSavingTopic = $state(false);
	let topicError: string | null = $state(null);
	let editTitle = $state('');
	let editKey = $state('');
	let editSubjectId = $state('');
	function startEditingTopic() {
		stopEditingLink();
		stopAdding();
		editTitle = data.topic.title;
		editKey = data.topic.key;
		editSubjectId = data.topic.subjectId;
		topicError = null;
		isEditingTopic = true;
	}
	function stopEditingTopic() {
		isEditingTopic = false;
		topicError = null;
	}

	// ---------- Course table ----------
	const columns: Column[] = [
		{ label: 'Course', key: 'course', width: '16rem', sortable: true },
		{ label: 'Textbook', key: 'textbook' },
		{ label: 'Chapter', key: 'chapter', width: '6rem', align: 'center', sortable: true },
		{ label: 'Chapter title', key: 'chapter-title' },
		{ label: 'Pages', key: 'pages', width: '10rem' },
		{ label: 'Notes', key: 'notes' },
		{ label: '', key: 'actions', width: '7.5rem' }
	];

	// sorting
	let sortKey: string = $state('course');
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
		if (key === 'chapter') return row.link.chapterNumber;
		// course: year, then state, then name
		return `${String(row.course.yearLevel).padStart(2, '0')} ${row.course.state ?? ''} ${row.course.name}`;
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

	// editing a course link
	let editingCourseId: string | null = $state(null);
	const isEditingLink = $derived(editingCourseId !== null);
	let isSavingLink = $state(false);
	let linkError: string | null = $state(null);
	let editChapter: number | null = $state(null);
	let editChapterTitle = $state('');
	let editPageStart: number | null = $state(null);
	let editPageEnd: number | null = $state(null);
	let editNotes = $state('');
	function startEditingLink(item: LinkItem) {
		stopEditingTopic();
		stopAdding();
		editingCourseId = item.course.id;
		editChapter = item.link.chapterNumber;
		editChapterTitle = item.link.chapterTitle ?? '';
		editPageStart = item.link.pageStart;
		editPageEnd = item.link.pageEnd;
		editNotes = item.link.notes ?? '';
		linkError = null;
	}
	function stopEditingLink() {
		editingCourseId = null;
		linkError = null;
	}

	// removing a course link
	let isRemoving = $state(false);
	let removeError: string | null = $state(null);

	// adding to a course
	let isAddActive = $state(false);
	let isAdding = $state(false);
	let addError: string | null = $state(null);
	let addCourseId = $state('');
	let addChapter: number | null = $state(null);
	let addChapterTitle = $state('');
	let addPageStart: number | null = $state(null);
	let addPageEnd: number | null = $state(null);
	let addNotes = $state('');
	const addCourse = $derived(data.availableCourses.find((c) => c.id === addCourseId));
	function startAdding() {
		stopEditingTopic();
		stopEditingLink();
		addCourseId = data.availableCourses[0]?.id ?? '';
		addChapter = null;
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

	const isBusy = $derived(isEditingTopic || isEditingLink || isAddActive);
</script>

<svelte:head>
	<title>Admin - {data.topic.title}</title>
</svelte:head>

<div class="page">
	<a class="back" href={resolve('/admin/topics')}>← Topics</a>

	<header class="page-header">
		<div>
			<h1>{data.topic.title}</h1>
			<p class="subtitle">
				{data.topic.subjectName} topic ·
				{#if data.topic.isActive}Active{:else}Hidden{/if}
			</p>
		</div>
		<span class="count">
			{data.links.length}
			{data.links.length === 1 ? 'course' : 'courses'}
		</span>
	</header>

	{#if topicError || linkError || removeError || addError}
		<div class="alerts">
			{#if topicError}
				<Alert variant="error" title="Update Error">
					<div class="pre">{topicError.trimStart()}</div>
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

	<!-- Topic details -->
	<section class="panel" class:editing={isEditingTopic}>
		<div class="panel-header">
			<h2>Details</h2>
			<div class="panel-actions">
				{#if isEditingTopic}
					<form
						method="POST"
						action="?/updateTopic"
						use:enhance={() => {
							topicError = null;
							isSavingTopic = true;
							return async ({ result, update }) => {
								isSavingTopic = false;
								if (result.type === 'failure') {
									topicError = (result.data as FormError)?.message ?? 'Could not save';
									return;
								}
								if (result.type === 'error') {
									topicError = (result.error as FormError)?.message ?? 'An error occurred';
									return;
								}
								stopEditingTopic();
								await update();
							};
						}}
					>
						<input type="hidden" name="title" value={editTitle} />
						<input type="hidden" name="key" value={editKey} />
						<input type="hidden" name="subjectId" value={editSubjectId} />
						<Button directive="success" aria-label="Save topic" disabled={isSavingTopic}>
							<Icon icon="check" />
						</Button>
					</form>
					<Button
						directive="danger"
						aria-label="Cancel editing"
						onclick={stopEditingTopic}
						disabled={isSavingTopic}
					>
						<Icon icon="cross" />
					</Button>
				{:else}
					<Button
						directive="warning"
						aria-label="Edit topic"
						onclick={startEditingTopic}
						disabled={isBusy}
					>
						<Icon icon="edit" />
					</Button>
				{/if}
			</div>
		</div>

		<dl class="details">
			<div>
				<dt>Title</dt>
				<dd>
					{#if isEditingTopic}
						<Input
							bind:value={editTitle}
							aria-label="Topic title"
							onkeydown={(e) => e.key === 'Escape' && stopEditingTopic()}
						/>
					{:else}
						{data.topic.title}
					{/if}
				</dd>
			</div>
			<div>
				<dt>Key</dt>
				<dd>
					{#if isEditingTopic}
						<Input
							mono
							bind:value={editKey}
							aria-label="Topic key"
							onkeydown={(e) => e.key === 'Escape' && stopEditingTopic()}
						/>
					{:else}
						<span class="key-pill">{data.topic.key}</span>
					{/if}
				</dd>
			</div>
			<div>
				<dt>Subject</dt>
				<dd>
					{#if isEditingTopic}
						<Select
							bind:value={editSubjectId}
							aria-label="Topic subject"
							disabled={data.links.length > 0}
							title={data.links.length > 0
								? 'Remove this topic from its courses to change the subject'
								: undefined}
						>
							{#each data.subjects as subject (subject.id)}
								<option value={subject.id}>{subject.name}</option>
							{/each}
						</Select>
					{:else}
						{data.topic.subjectName}
					{/if}
				</dd>
			</div>
			<div>
				<dt>Created</dt>
				<dd class="muted">{dateFormat.format(data.topic.createdAt)}</dd>
			</div>
			<div>
				<dt>Updated</dt>
				<dd class="muted">{dateFormat.format(data.topic.updatedAt)}</dd>
			</div>
		</dl>
	</section>

	<!-- Courses this topic appears in -->
	<section class="section">
		<div class="section-header">
			<h2>Courses</h2>
			<p class="subtitle">
				Where this topic is taught, and where to find it in each course's textbook.
			</p>
		</div>

		<DataTable
			{columns}
			rows={sortedLinks}
			getKey={(l) => l.course.id}
			emptyText="This topic isn't in any courses yet."
			{sortKey}
			{sortOrder}
			{onSort}
		>
			{#snippet row(item)}
				{#if editingCourseId === item.course.id}
					<tr class="editing">
						<td class="cell-primary" title={courseLabel(item.course)}>
							{courseLabel(item.course)}
						</td>
						<td class="muted" title={item.course.textbook ?? undefined}>
							{item.course.textbook ?? '—'}
						</td>
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
									action="?/updateCourseLink"
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
									<input type="hidden" name="courseId" value={item.course.id} />
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
						<td class="cell-primary" title={courseLabel(item.course)}>
							<a class="row-link" href={resolve(`/admin/courses/${item.course.id}`)}>
								{courseLabel(item.course)}
							</a>
						</td>
						<td title={item.course.textbook ?? undefined}>
							{#if item.course.textbook}{item.course.textbook}{:else}<span class="muted">—</span
								>{/if}
						</td>
						<td class="center">{item.link.chapterNumber}</td>
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
									action="?/removeFromCourse"
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
									<input type="hidden" name="courseId" value={item.course.id} />
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
							{#if data.availableCourses.length > 0}
								<Button
									directive="success"
									aria-label="Add to a course"
									onclick={startAdding}
									disabled={isBusy}
								>
									<Icon icon="plus" />
								</Button>
							{:else}
								<span class="muted">
									This topic is in every {data.topic.subjectName} course.
								</span>
							{/if}
						</td>
					</tr>
				{:else}
					<tr class="editing">
						<td>
							<Select
								bind:value={addCourseId}
								aria-label="Course"
								onkeydown={(e) => e.key === 'Escape' && stopAdding()}
							>
								{#each data.availableCourses as course (course.id)}
									<option value={course.id}>{courseLabel(course)}</option>
								{/each}
							</Select>
						</td>
						<td class="muted" title={addCourse?.textbook ?? undefined}>
							{addCourse?.textbook ?? '—'}
						</td>
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
									action="?/addToCourse"
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
									<input type="hidden" name="courseId" value={addCourseId} />
									<input type="hidden" name="chapterNumber" value={numberField(addChapter)} />
									<input type="hidden" name="chapterTitle" value={addChapterTitle} />
									<input type="hidden" name="pageStart" value={numberField(addPageStart)} />
									<input type="hidden" name="pageEnd" value={numberField(addPageEnd)} />
									<input type="hidden" name="notes" value={addNotes} />
									<Button
										directive="success"
										aria-label="Add to course"
										disabled={isAdding || !addCourseId || numberField(addChapter) === ''}
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

	/* Topic details panel: flat, hairline border, same surface as DataTable */
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

	.row-link {
		color: inherit;
		text-decoration: none;

		&:hover {
			text-decoration: underline;
		}
	}

	.page-range {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.375rem;
	}
</style>
