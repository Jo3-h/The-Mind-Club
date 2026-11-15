<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/basic/Button.svelte';
	import DataTable, { type Column } from '$lib/components/basic/DataTable.svelte';
	import Input from '$lib/components/basic/Input.svelte';
	import { slugify } from '$lib/utils/slugify';
	import Icon from '$lib/components/branding/Icon.svelte';
	import type { PageProps } from './$types';
	import { STATES, YEAR_LEVEL_CONSTRAINT, YEAR_LEVELS } from '$lib/constants/profile';
	import Select from '$lib/components/basic/Select.svelte';
	import Alert from '$lib/components/basic/Alert.svelte';

	const { data }: PageProps = $props();

	type FormError = { message?: string };
	const columns: Column[] = [
		{ label: 'Name', key: 'name', width: '12rem', sortable: true },
		{ label: 'Key', key: 'key', width: '10rem' },
		{ label: 'Subject', key: 'subject', width: '10rem', sortable: true },
		{ label: 'State', key: 'state', width: '8rem', sortable: true },
		{ label: 'Year Level', key: 'year-level', width: '8rem', sortable: true },
		{ label: 'Topic Count', key: 'topic-count', width: '8rem', sortable: true },
		{ label: 'Actions', key: 'actions', width: '8rem' }
	];

	// sorting state management
	let sortKey: string = $state('name');
	let sortOrder: 'asc' | 'desc' = $state('asc');
	function onSort(key: string) {
		if (sortKey === key) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortOrder = 'asc';
		}
	}
	const sortedCourses = $derived.by(() => {
		return [...data.courses].sort((a, b) => {
			const aValue = getSortValue(a, sortKey);
			const bValue = getSortValue(b, sortKey);

			if (aValue === bValue) return 0;
			if (aValue === null) return sortOrder === 'asc' ? -1 : 1;
			if (bValue === null) return sortOrder === 'asc' ? 1 : -1;

			if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
			return sortOrder === 'asc' ? 1 : -1;
		});
	});

	function getSortValue(row: (typeof data.courses)[number], key: string): string | number | null {
		if (key === 'subject') return row.course.subjectName ?? null;
		if (key === 'topic-count') return row.topicCount ?? null;
		return row.course[key as keyof typeof row.course] as string | number | null;
	}

	// editing state management
	let isEditing = $state(false);
	let isUpdating = $state(false);
	let editingCourseId: string | null = $state(null);
	let newName = $state('');
	let newKey = $state('');
	let newYearLevel: number = $state(0);
	let newState: (typeof STATES)[number] | null = $state(STATES[0]);
	let newSubjectId: string | null = $state(null);
	let updateError: string | null = $state('');
	function stopEditing() {
		isEditing = false;
		editingCourseId = null;
		newName = '';
		newKey = '';
		newYearLevel = 0;
		newSubjectId = null;
	}
	function setEditingId(id: string) {
		isEditing = true;
		editingCourseId = id;
		const course = data.courses.find((c) => c.course.id === id)?.course;
		if (course) {
			newName = course.name;
			newKey = course.key;
			newYearLevel = course.yearLevel;
			newState = course.state;
			newSubjectId = course.subjectId;
		}
	}

	// deletion state management
	let isDeleting = $state(false);
	let deleteError: string | null = $state('');

	// addition state management
	let isAdding = $state(false);
	let addName = $state('');
	let addYearLevel = $state(YEAR_LEVELS[0]);
	let addState: (typeof STATES)[number] | null = $state(STATES[0]);
	let addSubjectId: string | null = $state(null);
	let addError: string | null = $state('');
	let isAddActive = $state(false);
	function startAdding() {
		addName = '';
		addSubjectId = data.subjects[0]?.id ?? null;
		addError = null;
		isAddActive = true;
	}
	function stopAdding() {
		isAdding = false;
		isAddActive = false;
		addName = '';
		addSubjectId = null;
	}

	const actionStyle = 'width: 3rem;';
</script>

<svelte:head>
	<title>Admin - Courses</title>
</svelte:head>

<div class="page">
	<header class="page-header">
		<div>
			<h1>Courses</h1>
			<p class="subtitle">Specific instances of a subject course over a learning period.</p>
		</div>
		<span class="count">
			{data.courses.length}
			{data.courses.length === 1 ? 'course' : 'courses'}
		</span>
	</header>

	{#if updateError || deleteError || addError}
		<div class="alerts">
			{#if updateError}
				<Alert variant="danger">
					<div class="pre">
						{updateError}
					</div>
				</Alert>
			{/if}
			{#if deleteError}
				<Alert variant="danger">
					<div class="pre">
						{deleteError}
					</div>
				</Alert>
			{/if}
			{#if addError}
				<Alert variant="danger">
					<div class="pre">
						{addError}
					</div>
				</Alert>
			{/if}
		</div>
	{/if}

	<DataTable
		{columns}
		rows={sortedCourses}
		getKey={(s) => s.course.id}
		emptyText="No Courses Yet"
		{sortKey}
		{sortOrder}
		{onSort}
	>
		{#snippet row(item)}
			{#if editingCourseId === item.course.id}
				<tr class="editing">
					<td>
						<Input
							type="text"
							name="name"
							bind:value={newName}
							placeholder="Name"
							aria-label="Course name"
						/>
					</td>
					<td>
						<Input
							type="key"
							mono
							name="key"
							bind:value={newKey}
							placeholder="Key"
							aria-label="Course key"
						/>
					</td>
					<td>
						<Select bind:value={newSubjectId} aria-label="Course subject">
							{#each data.subjects as subject (subject.id)}
								<option value={subject.id}>{subject.name}</option>
							{/each}
						</Select>
					</td>
					<td>
						<Select bind:value={newState} aria-label="Course state">
							{#each STATES as state (state)}
								<option value={state}>{state}</option>
							{/each}
						</Select>
					</td>
					<td class="center">
						<Input
							type="number"
							name="year-level"
							bind:value={newYearLevel}
							min={YEAR_LEVEL_CONSTRAINT.MIN}
							max={YEAR_LEVEL_CONSTRAINT.MAX}
							step={YEAR_LEVEL_CONSTRAINT.STEP}
							placeholder="Year Level"
							aria-label="Course year level"
						/>
					</td>
					<td></td>

					<!-- Actions columns -->
					<td>
						<div class="actions always">
							<form
								method="POST"
								action="?/updateCourse"
								use:enhance={() => {
									updateError = null;
									isUpdating = true;
									return async ({ result, update }) => {
										if (result.type === 'failure') {
											updateError =
												(result.data as FormError)?.message ?? 'Could not update course';
										} else if (result.type === 'error') {
											updateError = (result.error as FormError)?.message ?? 'An Error occurred';
										} else if (result.type === 'success') {
											updateError = null;
											stopEditing();
											await update();
										}
										isUpdating = false;
									};
								}}
							>
								<input type="hidden" name="id" value={editingCourseId} />
								<input type="hidden" name="name" value={newName} />
								<input type="hidden" name="key" value={newKey} />
								<input type="hidden" name="yearLevel" value={newYearLevel} />
								<input type="hidden" name="state" value={newState} />
								<input type="hidden" name="subjectId" value={newSubjectId} />
								<Button variant="success" aria-label="Save Course" style={actionStyle}>
									<Icon icon="check" />
								</Button>
							</form>
							<Button
								variant="danger"
								style={actionStyle}
								disabled={isUpdating}
								aria-label="Cancel Edit"
								onclick={stopEditing}
							>
								<Icon icon="cross" />
							</Button>
						</div>
					</td>
				</tr>
			{:else}
				<tr class:dimmed={isEditing}>
					<td class="cell-primary">
						<a class="row-link" href={resolve(`/admin/courses/${item.course.id}`)}>
							{item.course.name}
						</a>
					</td>
					<td><span class="key-pill">{item.course.key}</span></td>
					<td class="center">{item.course.subjectName}</td>
					<td class="center">{item.course.state}</td>
					<td class="center">{item.course.yearLevel}</td>
					<td class="center">{item.topicCount}</td>
					<td>
						<div class="actions">
							<Button
								variant="warning"
								style={actionStyle}
								aria-label="Edit course"
								onclick={() => setEditingId(item.course.id)}
								disabled={isEditing}
							>
								<Icon icon="edit" />
							</Button>
							<form
								method="POST"
								action="?/deleteCourse"
								use:enhance={() => {
									deleteError = null;
									isDeleting = true;

									return async ({ result, update }) => {
										if (result.type === 'failure') {
											deleteError =
												(result.data as { message?: string })?.message ?? 'Could not delete';
											isDeleting = false;
											return;
										}
										if (result.type === 'error') {
											deleteError =
												(result.error as { message?: string })?.message ?? 'An error occurred';
											isDeleting = false;
											return;
										}
										if (result.type === 'success') {
											deleteError = null;
											isDeleting = false;
											await update();
										}
									};
								}}
							>
								<input type="hidden" name="id" value={item.course.id} />
								<Button
									variant="danger"
									style={actionStyle}
									aria-label="Delete course"
									disabled={isEditing || isDeleting}
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
						<Button
							variant="success"
							style={actionStyle}
							aria-label="Add course"
							onclick={startAdding}
						>
							<Icon icon="plus" />
						</Button>
					</td>
				</tr>
			{:else}
				<tr class="editing">
					<td>
						<Input
							name="name"
							form="add-course"
							bind:value={addName}
							placeholder="Course name"
							aria-label="New course name"
							autofocus
							onkeydown={(e) => e.key === 'Escape' && stopAdding()}
						/>
					</td>
					<td><span class="key-pill">{slugify(addName) || 'generated-from-name'}</span></td>
					<td class="center">
						<Select
							name="subject"
							bind:value={addSubjectId}
							aria-label="New course subject"
							onkeydown={(e) => e.key === 'Escape' && stopAdding()}
						>
							{#each data.subjects as subject (subject.id)}
								<option value={subject.id}>{subject.name}</option>
							{/each}
						</Select>
					</td>
					<td class="center">
						<Select
							name="state"
							bind:value={addState}
							aria-label="New course state"
							onkeydown={(e) => e.key === 'Escape' && stopAdding()}
						>
							{#each STATES as state (state)}
								<option value={state}>{state}</option>
							{/each}
						</Select>
					</td>
					<td class="center">
						<Input
							name="yearLevel"
							form="add-course"
							type="number"
							bind:value={addYearLevel}
							min={YEAR_LEVEL_CONSTRAINT.MIN}
							max={YEAR_LEVEL_CONSTRAINT.MAX}
							step={YEAR_LEVEL_CONSTRAINT.STEP}
							placeholder="Year level"
							aria-label="New course year level"
							onkeydown={(e) => e.key === 'Escape' && stopAdding()}
						/>
					</td>
					<td class="placeholder center">-</td>
					<td>
						<div class="actions always">
							<form
								id="add-course"
								method="POST"
								action="?/createCourse"
								use:enhance={() => {
									addError = null;
									isAdding = true;
									return async ({ result, update }) => {
										isAdding = false;
										if (result.type === 'failure') {
											addError = (result.data as { message?: string })?.message ?? 'Could not add';
											return;
										}
										if (result.type === 'error') {
											addError = result.error?.message ?? 'An error occurred';
											return;
										}
										stopAdding();
										await update();
									};
								}}
							>
								<input type="hidden" name="name" value={addName} />
								<input type="hidden" name="key" value={slugify(addName)} />
								<input type="hidden" name="state" value={addState} />
								<input type="hidden" name="yearLevel" value={addYearLevel} />
								<input type="hidden" name="subjectId" value={addSubjectId} />
								<Button
									variant="success"
									style={actionStyle}
									aria-label="Save course"
									disabled={isAdding || !addName.trim() || !addSubjectId}
								>
									<Icon icon="check" />
								</Button>
							</form>
							<Button
								variant="danger"
								style={actionStyle}
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
</div>

<style>
	.page {
		padding: var(--gap-large);
		display: flex;
		flex-direction: column;
		gap: var(--gap-large);
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

	.row-link {
		color: inherit;
		text-decoration: none;

		&:hover {
			text-decoration: underline;
		}
	}
</style>
