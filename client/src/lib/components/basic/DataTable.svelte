<script module lang="ts">
	export interface Column {
		key: string;
		label: string;
		/** Any CSS width, e.g. '40%' or '7.5rem'. Omit to share the remaining space. */
		width?: string;
		align?: 'left' | 'right' | 'center';
		sortable?: boolean;
	}
</script>

<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

	interface Props {
		columns: Column[];
		rows: T[];
		/** Stable identity for each row, used to key the list. */
		getKey: (row: T) => string | number;
		/** Renders a full <tr> for one row. */
		row: Snippet<[T, number]>;
		/** Optional custom empty state; falls back to emptyText. */
		empty?: Snippet;
		footer?: Snippet;
		emptyText?: string;
		sortKey?: string | null;
		sortOrder?: 'asc' | 'desc';
		onSort?: (key: string) => void;
	}

	let {
		columns,
		rows,
		getKey,
		row,
		empty,
		emptyText = 'Nothing here yet.',
		footer,
		sortKey = null,
		sortOrder = 'asc',
		onSort
	}: Props = $props();
</script>

<div class="data-table">
	<table>
		<colgroup>
			{#each columns as column (column.key)}
				<col style:width={column.width} />
			{/each}
		</colgroup>
		<thead>
			<tr>
				{#each columns as column (column.key)}
					<th
						class:right={column.align === 'right'}
						class:center={column.align === 'center'}
						aria-sort={column.sortable && sortKey === column.key
							? sortOrder === 'asc'
								? 'ascending'
								: 'descending'
							: undefined}
					>
						{#if column.sortable}
							<button type="button" class="sort" onclick={() => onSort?.(column.key)}>
								{column.label}
								<span class="sort-indicator">
									{#if sortKey === column.key}{sortOrder === 'asc' ? '▲' : '▼'}{/if}
								</span>
							</button>
						{:else}
							{column.label}
						{/if}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as item, index (getKey(item))}
				{@render row(item, index)}
			{:else}
				<tr>
					<td colspan={columns.length} class="empty">
						{#if empty}{@render empty()}{:else}{emptyText}{/if}
					</td>
				</tr>
			{/each}
		</tbody>
		{#if footer}
			<tfoot>{@render footer()}</tfoot>
		{/if}
	</table>
</div>

<style>
	.data-table {
		--_border: var(--grey);
		--_border-subtle: color-mix(in srgb, var(--grey) 55%, transparent);
		--_surface: #fff;
		--_surface-subtle: hsl(210, 20%, 98%);
		--_surface-hover: hsl(210, 20%, 96.5%);
		--_muted: hsl(210, 8%, 45%);
		--_accent: var(--orange);

		border: 1px solid var(--_border);
		border-radius: 8px;
		background: var(--_surface);
		overflow: hidden;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
		font-size: 0.875rem;
	}

	th {
		padding: 0.625rem 1rem;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--_muted);
		background: var(--_surface-subtle);
		border-bottom: 1px solid var(--_border);

		&.right {
			text-align: right;
		}
		&.center {
			text-align: center;
		}

		.sort {
			display: inline-flex;
			align-items: center;
			gap: 0.25rem;
			padding: 0;
			border: none;
			background: none;
			font: inherit;
			color: inherit;
			letter-spacing: inherit;
			text-transform: inherit;
			cursor: pointer;
		}
		.sort-indicator {
			font-size: 0.625rem;
			color: var(--_accent);
		}
	}

	.empty {
		padding: 2.5rem 1rem;
		text-align: center;
		color: var(--_muted);
	}

	/*
	 * Rows are rendered by the caller's snippet, so Svelte scopes them to the
	 * caller, not to this component. These rules are :global but contained
	 * inside .data-table, so they only affect tables built with this component.
	 */
	.data-table :global {
		td {
			padding: 0.625rem 1rem;
			vertical-align: middle;
			border-bottom: 1px solid var(--_border-subtle);
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;

			&.right {
				text-align: right;
			}
			&.center {
				text-align: center;
			}
		}

		tbody tr:last-child td {
			border-bottom: none;
		}

		tbody tr {
			transition:
				background-color 80ms ease,
				opacity 120ms ease;

			&:hover {
				background: var(--_surface-hover);
			}
		}

		/* Fade other rows while one is being edited */
		tr.dimmed {
			opacity: 0.55;

			&:hover {
				background: transparent;
			}
		}

		/* The row currently being edited */
		tr.editing,
		tr.editing:hover {
			background: color-mix(in srgb, var(--_accent) 6%, transparent);
		}

		tr.editing td {
			padding-top: 0.5rem;
			padding-bottom: 0.5rem;
		}

		tr.editing td:first-child {
			box-shadow: inset 3px 0 0 var(--_accent);
		}

		/* Primary text in a row */
		.cell-primary {
			font-weight: 500;
		}

		/* Secondary, monospaced value such as a key */
		.key-pill {
			display: inline-block;
			max-width: 100%;
			padding: 0.125rem 0.5rem;
			border: 1px solid var(--_border-subtle);
			border-radius: 4px;
			background: var(--_surface-subtle);
			font-family: 'IBM Plex Mono', ui-monospace, monospace;
			font-size: 0.75rem;
			color: var(--_muted);
			overflow: hidden;
			text-overflow: ellipsis;
			vertical-align: middle;
		}

		/* Row action buttons: shown on hover / focus, always on touch */
		.actions {
			display: flex;
			justify-content: flex-end;
			align-items: center;
			gap: 0.375rem;
			opacity: 0;
			transition: opacity 100ms ease;

			form {
				display: flex;
			}
		}

		tbody tr:hover .actions,
		tbody tr:focus-within .actions,
		.actions.always {
			opacity: 1;
		}

		@media (hover: none) {
			.actions {
				opacity: 1;
			}
		}
	}
</style>
