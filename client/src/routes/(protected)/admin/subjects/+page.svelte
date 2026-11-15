<script lang="ts">
	import { enhance } from '$app/forms';
	import Alert from '$lib/components/basic/Alert.svelte';
	import Button from '$lib/components/basic/Button.svelte';
	import DataTable, { type Column } from '$lib/components/basic/DataTable.svelte';
	import Icon from '$lib/components/branding/Icon.svelte';
	import type { PageProps } from './$types';
	import { slugify } from '$lib/utils/slugify';
	import Input from '$lib/components/basic/Input.svelte';

	const { data }: PageProps = $props();

	const columns: Column[] = [
		{ key: 'name', label: 'Name', width: '40%' },
		{ key: 'key', label: 'Key' },
		{ key: 'actions', label: '', width: '7.5rem' }
	];

	// editing state for the subject being edited
	let editingId: string | null = $state(null);
	const isActiveEdit = $derived(editingId !== null);
	let newName = $state('');
	let newKey = $state('');
	function setEditingId(id: string | null) {
		editingId = id;
		if (id !== null) {
			const subject = data.subjects.find((s) => s.id === id);
			if (subject) {
				newName = subject.name;
				newKey = subject.key;
			}
		}
	}
	function stopEditing() {
		editingId = null;
		newName = '';
		newKey = '';
		updateError = null;
	}
	let isUpdating: boolean = $state(false);
	let updateError: string | null = $state(null);

	// Deleting state for the subject being deleted
	let deleteError: string | null = $state(null);
	let isDeleting: boolean = $state(false);

	// Adding state for the subject being added
	let addError: string | null = $state(null);
	let isAdding: boolean = $state(false);
	let addName = $state('');
	function stopAdding() {
		isAdding = false;
		addName = '';
		addError = null;
	}

	const actionStyle = 'width: 3rem;';
</script>

<svelte:head>
	<title>Admin - Subjects</title>
</svelte:head>

<div class="page">
	<header class="page-header">
		<div>
			<h1>Subjects</h1>
			<p class="subtitle">The top level of the curriculum. Courses and topics sit underneath.</p>
		</div>
		<span class="count">
			{data.subjects.length}
			{data.subjects.length === 1 ? 'subject' : 'subjects'}
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

	<DataTable {columns} rows={data.subjects} getKey={(s) => s.id} emptyText="No subjects yet.">
		{#snippet row(subject)}
			{#if editingId === subject.id}
				<tr class="editing">
					<td>
						<input
							type="text"
							name="name"
							bind:value={newName}
							placeholder="Name"
							aria-label="Subject name"
						/>
					</td>
					<td>
						<Input
							type="text"
							name="key"
							mono
							bind:value={newKey}
							placeholder="Key"
							aria-label="Subject key"
						/>
					</td>
					<td>
						<div class="actions always">
							<form
								method="POST"
								action="?/updateSubject"
								use:enhance={() => {
									updateError = null;
									isUpdating = true;

									return async ({ result, update }) => {
										if (result.type === 'failure') {
											updateError =
												(result.data as { message?: string })?.message ?? 'Could not save';
											isUpdating = false;
											return;
										}
										if (result.type === 'error') {
											updateError =
												(result.error as { message?: string })?.message ?? 'An error occurred';
											isUpdating = false;
											return;
										}
										if (result.type === 'success') {
											updateError = null;
											isUpdating = false;
											stopEditing();
											await update();
										}
									};
								}}
							>
								<input type="hidden" name="id" value={subject.id} />
								<input type="hidden" name="name" value={newName} />
								<input type="hidden" name="key" value={newKey} />
								<Button variant="success" style={actionStyle} aria-label="Save subject">
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
					<td class="cell-primary">{subject.name}</td>
					<td><span class="key-pill">{subject.key}</span></td>
					<td>
						<div class="actions">
							<Button
								variant="warning"
								style={actionStyle}
								aria-label="Edit subject"
								onclick={() => setEditingId(subject.id)}
								disabled={isActiveEdit}
							>
								<Icon icon="edit" />
							</Button>
							<form
								method="POST"
								action="?/deleteSubject"
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
								<input type="hidden" name="id" value={subject.id} />
								<Button
									variant="danger"
									style={actionStyle}
									aria-label="Delete subject"
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
			<tr class="editing">
				<td>
					<Input
						name="name"
						form="add-subject"
						bind:value={addName}
						placeholder="Subject name"
						aria-label="New subject name"
						autofocus
						onkeydown={(e) => e.key === 'Escape' && stopAdding()}
					/>
				</td>
				<td><span class="key-pill">{slugify(addName) || 'generated-from-name'}</span></td>
				<td>
					<div class="actions always">
						<form
							id="add-subject"
							method="POST"
							action="?/createSubject"
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
							<Button
								variant="success"
								style={actionStyle}
								aria-label="Save subject"
								disabled={isAdding || !addName.trim()}
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
		{/snippet}
	</DataTable>
</div>

<style>
	.page {
		max-width: 56rem;
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
</style>
