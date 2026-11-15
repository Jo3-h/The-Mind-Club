<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Alert from '$lib/components/basic/Alert.svelte';
	import Button from '$lib/components/basic/Button.svelte';
	import DataTable, { type Column } from '$lib/components/basic/DataTable.svelte';
	import Input from '$lib/components/basic/Input.svelte';
	import Select from '$lib/components/basic/Select.svelte';
	import Icon from '$lib/components/branding/Icon.svelte';
	import { slugify } from '$lib/utils/slugify';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();

	type FormError = { message?: string };
	const columns: Column[] = [
		{ label: 'Title', key: 'title', width: '14rem', sortable: true },
		{ label: 'Key', key: 'key' },
		{ label: 'Subject', key: 'subject', width: '10rem', sortable: true },
		{ label: 'Courses', key: 'course-count', width: '7rem', sortable: true },
		{ label: '', key: 'actions', width: '7.5rem' }
	];

	type TopicItem = (typeof data.topics)[number];

	// sorting state management
	let sortKey: string = $state('title');
	let sortOrder: 'asc' | 'desc' = $state('asc');
	function onSort(key: string) {
		if (sortKey === key) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortOrder = 'asc';
		}
	}
	function getSortValue(row: TopicItem, key: string): string | number | null {
		if (key === 'subject') return row.topic.subjectName ?? null;
		if (key === 'course-count') return row.courseCount ?? null;
		return row.topic[key as keyof typeof row.topic] as string | number | null;
	}
	const sortedTopics = $derived.by(() => {
		return [...data.topics].sort((a, b) => {
			const aValue = getSortValue(a, sortKey);
			const bValue = getSortValue(b, sortKey);

			if (aValue === bValue) return 0;
			if (aValue === null) return sortOrder === 'asc' ? -1 : 1;
			if (bValue === null) return sortOrder === 'asc' ? 1 : -1;

			if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
			return sortOrder === 'asc' ? 1 : -1;
		});
	});

	// editing state for the topic being edited
	let editingId: string | null = $state(null);
	const isActiveEdit = $derived(editingId !== null);
	let newTitle = $state('');
	let newKey = $state('');
	let newSubjectId: string = $state('');
	let isUpdating = $state(false);
	let updateError: string | null = $state(null);
	function setEditingId(id: string) {
		stopAdding();
		editingId = id;
		const topic = data.topics.find((t) => t.topic.id === id)?.topic;
		if (topic) {
			newTitle = topic.title;
			newKey = topic.key;
			newSubjectId = topic.subjectId;
		}
	}
	function stopEditing() {
		editingId = null;
		newTitle = '';
		newKey = '';
		newSubjectId = '';
		updateError = null;
	}

	// deleting state
	let isDeleting = $state(false);
	let deleteError: string | null = $state(null);

	// adding state
	let isAddActive = $state(false);
	let isAdding = $state(false);
	let addTitle = $state('');
	let addSubjectId: string = $state('');
	let addError: string | null = $state(null);
	function startAdding() {
		stopEditing();
		addTitle = '';
		addSubjectId = data.subjects[0]?.id ?? '';
		addError = null;
		isAddActive = true;
	}
	function stopAdding() {
		isAddActive = false;
		addTitle = '';
		addSubjectId = '';
		addError = null;
	}

	const actionStyle = 'width: 3rem;';
</script>

<svelte:head>
	<title>Admin - Topics</title>
</svelte:head>

<div class="page">
	<header class="page-header">
		<div>
			<h1>Topics</h1>
			<p class="subtitle">
				One chapter's worth of content. Topics belong to a subject and can sit in many courses.
			</p>
		</div>
		<span class="count">
			{data.topics.length}
			{data.topics.length === 1 ? 'topic' : 'topics'}
		</span>
	</header>

	{#if updateError || deleteError || addError}
		<div class="alerts">
			{#if updateError}
				<Alert variant="danger" title="Update Error">
					<div class="pre">{updateError.trimStart()}</div>
				</Alert>
			{/if}
			{#if deleteError}
				<Alert variant="danger" title="Delete Error">
					<div class="pre">{deleteError.trimStart()}</div>
				</Alert>
			{/if}
			{#if addError}
				<Alert variant="danger" title="Add Error">
					<div class="pre">{addError.trimStart()}</div>
				</Alert>
			{/if}
		</div>
	{/if}

	<DataTable
		{columns}
		rows={sortedTopics}
		getKey={(t) => t.topic.id}
		emptyText="No topics yet."
		{sortKey}
		{sortOrder}
		{onSort}
	>
		{#snippet row(item)}
			{#if editingId === item.topic.id}
				<tr class="editing">
					<td>
						<Input
							type="text"
							name="title"
							bind:value={newTitle}
							placeholder="Title"
							aria-label="Topic title"
							onkeydown={(e) => e.key === 'Escape' && stopEditing()}
						/>
					</td>
					<td>
						<Input
							type="text"
							name="key"
							mono
							bind:value={newKey}
							placeholder="Key"
							aria-label="Topic key"
							onkeydown={(e) => e.key === 'Escape' && stopEditing()}
						/>
					</td>
					<td>
						<Select bind:value={newSubjectId} aria-label="Topic subject">
							{#each data.subjects as subject (subject.id)}
								<option value={subject.id}>{subject.name}</option>
							{/each}
						</Select>
					</td>
					<td class="center">{item.courseCount}</td>
					<td>
						<div class="actions always">
							<form
								method="POST"
								action="?/updateTopic"
								use:enhance={() => {
									updateError = null;
									isUpdating = true;
									return async ({ result, update }) => {
										isUpdating = false;
										if (result.type === 'failure') {
											updateError = (result.data as FormError)?.message ?? 'Could not save';
											return;
										}
										if (result.type === 'error') {
											updateError = (result.error as FormError)?.message ?? 'An error occurred';
											return;
										}
										stopEditing();
										await update();
									};
								}}
							>
								<input type="hidden" name="id" value={item.topic.id} />
								<input type="hidden" name="title" value={newTitle} />
								<input type="hidden" name="key" value={newKey} />
								<input type="hidden" name="subjectId" value={newSubjectId} />
								<Button
									variant="success"
									style={actionStyle}
									aria-label="Save topic"
									disabled={isUpdating}
								>
									<Icon icon="check" />
								</Button>
							</form>
							<Button
								variant="danger"
								style={actionStyle}
								disabled={isUpdating}
								aria-label="Cancel editing"
								onclick={stopEditing}
							>
								<Icon icon="cross" />
							</Button>
						</div>
					</td>
				</tr>
			{:else}
				<tr class:dimmed={isActiveEdit}>
					<td class="cell-primary">
						<a class="row-link" href={resolve(`/admin/topics/${item.topic.id}`)}>
							{item.topic.title}
						</a>
					</td>
					<td><span class="key-pill">{item.topic.key}</span></td>
					<td>{item.topic.subjectName}</td>
					<td class="center">{item.courseCount}</td>
					<td>
						<div class="actions">
							<Button
								variant="warning"
								style={actionStyle}
								aria-label="Edit topic"
								onclick={() => setEditingId(item.topic.id)}
								disabled={isActiveEdit}
							>
								<Icon icon="edit" />
							</Button>
							<form
								method="POST"
								action="?/deleteTopic"
								use:enhance={() => {
									deleteError = null;
									isDeleting = true;
									return async ({ result, update }) => {
										isDeleting = false;
										if (result.type === 'failure') {
											deleteError = (result.data as FormError)?.message ?? 'Could not delete';
											return;
										}
										if (result.type === 'error') {
											deleteError = (result.error as FormError)?.message ?? 'An error occurred';
											return;
										}
										await update();
									};
								}}
							>
								<input type="hidden" name="id" value={item.topic.id} />
								<Button
									variant="danger"
									style={actionStyle}
									aria-label="Delete topic"
									disabled={isActiveEdit || isDeleting}
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
							aria-label="Add topic"
							onclick={startAdding}
							disabled={isActiveEdit || data.subjects.length === 0}
						>
							<Icon icon="plus" />
						</Button>
					</td>
				</tr>
			{:else}
				<tr class="editing">
					<td>
						<Input
							name="title"
							form="add-topic"
							bind:value={addTitle}
							placeholder="Topic title"
							aria-label="New topic title"
							autofocus
							onkeydown={(e) => e.key === 'Escape' && stopAdding()}
						/>
					</td>
					<td><span class="key-pill">{slugify(addTitle) || 'generated-from-title'}</span></td>
					<td>
						<Select
							bind:value={addSubjectId}
							aria-label="New topic subject"
							onkeydown={(e) => e.key === 'Escape' && stopAdding()}
						>
							{#each data.subjects as subject (subject.id)}
								<option value={subject.id}>{subject.name}</option>
							{/each}
						</Select>
					</td>
					<td class="placeholder center">-</td>
					<td>
						<div class="actions always">
							<form
								id="add-topic"
								method="POST"
								action="?/createTopic"
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
								<input type="hidden" name="title" value={addTitle} />
								<input type="hidden" name="subjectId" value={addSubjectId} />
								<Button
									variant="success"
									style={actionStyle}
									aria-label="Save topic"
									disabled={isAdding || !addTitle.trim() || !addSubjectId}
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
