<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/basic/Button.svelte';
	import AccountTypePicker from '$lib/components/auth/AccountTypePicker.svelte';
	import {
		STATES,
		YEAR_LEVELS,
		TEACHING_MODES,
		TEACHING_MODE_LABELS
	} from '$lib/constants/profile';

	let { data, form } = $props();

	// restore state if the server sent the form back with errors
	let accountType = $state<'student' | 'tutor' | ''>(
		(form?.values?.accountType as 'student' | 'tutor') ?? ''
	);
	let step = $state<1 | 2>(form?.values ? 2 : 1);
	let teachingMode = $state(form?.values?.teachingMode ?? '');
	let submitting = $state(false);

	const v = (key: string) => form?.values?.[key] ?? '';
	const err = (key: string) => form?.fieldErrors?.[key];
	const needsPostcode = $derived(
		accountType === 'tutor' && teachingMode && teachingMode !== 'online'
	);
</script>

<div class="onboarding-page">
	<div class="onboarding">
		<span class="step-label">STEP {step} OF 2</span>

		<form
			method="post"
			novalidate
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update({ reset: false });
					submitting = false;
				};
			}}
		>
			<!-- step 1 stays in the DOM (hidden) so accountType is still submitted -->
			<div class="step" hidden={step !== 1}>
				<span class="title">Welcome{data.firstName ? `, ${data.firstName}` : ''}</span>
				<span class="subtitle">How will you be using The Mind Club?</span>

				<AccountTypePicker bind:value={accountType} />

				<Button directive="theme" type="button" disabled={!accountType} onclick={() => (step = 2)}>
					Continue
				</Button>
			</div>

			{#if step === 2 && accountType === 'student'}
				<div class="step">
					<span class="title">About your studies</span>
					<span class="subtitle">This helps us show you sessions at the right level.</span>

					<label class="field">
						<span>YEAR LEVEL</span>
						<select name="yearLevel" value={v('yearLevel')}>
							<option value="" disabled>Select year</option>
							{#each YEAR_LEVELS as y (y)}
								<option value={String(y)}>Year {y}</option>
							{/each}
						</select>
						{#if err('yearLevel')}<small class="error">{err('yearLevel')}</small>{/if}
					</label>

					<div class="row">
						<label class="field">
							<span>STATE</span>
							<select name="state" value={v('state')}>
								<option value="" disabled>Select</option>
								{#each STATES as s (s)}
									<option value={s}>{s}</option>
								{/each}
							</select>
							{#if err('state')}<small class="error">{err('state')}</small>{/if}
						</label>

						<label class="field">
							<span>POSTCODE <em>optional</em></span>
							<input
								name="postcode"
								inputmode="numeric"
								maxlength="4"
								value={v('postcode')}
								placeholder="5000"
							/>
							{#if err('postcode')}<small class="error">{err('postcode')}</small>{/if}
						</label>
					</div>

					<label class="field">
						<span>SCHOOL <em>optional</em></span>
						<input
							name="school"
							maxlength="120"
							value={v('school')}
							placeholder="e.g. Adelaide High School"
						/>
					</label>
				</div>
			{/if}

			{#if step === 2 && accountType === 'tutor'}
				<div class="step">
					<span class="title">Your tutor profile</span>
					<span class="subtitle"
						>Students see this when browsing sessions. You can edit it later.</span
					>

					<label class="field">
						<span>HEADLINE</span>
						<input
							name="headline"
							maxlength="80"
							value={v('headline')}
							placeholder="e.g. Maths Methods tutor, 99.5 ATAR"
						/>
						{#if err('headline')}<small class="error">{err('headline')}</small>{/if}
					</label>

					<label class="field">
						<span>BIO</span>
						<textarea
							name="bio"
							rows="4"
							maxlength="600"
							value={v('bio')}
							placeholder="What you teach, your experience, and how you run a session"></textarea>
						{#if err('bio')}<small class="error">{err('bio')}</small>{/if}
					</label>

					<fieldset class="field">
						<legend>HOW DO YOU TEACH?</legend>
						<div class="segmented">
							{#each TEACHING_MODES as m (m)}
								<label>
									<input type="radio" name="teachingMode" value={m} bind:group={teachingMode} />
									<span>{TEACHING_MODE_LABELS[m]}</span>
								</label>
							{/each}
						</div>
						{#if err('teachingMode')}<small class="error">{err('teachingMode')}</small>{/if}
					</fieldset>

					<div class="row">
						<label class="field">
							<span>STATE</span>
							<select name="state" value={v('state')}>
								<option value="" disabled>Select</option>
								{#each STATES as s (s)}
									<option value={s}>{s}</option>
								{/each}
							</select>
							{#if err('state')}<small class="error">{err('state')}</small>{/if}
						</label>

						<label class="field">
							<span
								>POSTCODE {#if !needsPostcode}<em>optional</em>{/if}</span
							>
							<input
								name="postcode"
								inputmode="numeric"
								maxlength="4"
								value={v('postcode')}
								placeholder="5000"
							/>
							{#if err('postcode')}<small class="error">{err('postcode')}</small>{/if}
						</label>
					</div>

					<label class="field">
						<span>WORKING WITH CHILDREN CHECK <em>optional for now</em></span>
						<input name="wwccNumber" maxlength="40" value={v('wwccNumber')} autocomplete="off" />
						<small class="hint"
							>Required before you can publish sessions with students under 18.</small
						>
					</label>
				</div>
			{/if}

			{#if step === 2}
				<div class="actions">
					<button type="button" class="back" onclick={() => (step = 1)}>Back</button>
					<Button directive="theme" disabled={submitting}>
						{submitting ? 'Setting up…' : 'Finish'}
					</Button>
				</div>
			{/if}
		</form>
	</div>
</div>

<style>
	.onboarding-page {
		display: grid;
		width: 100%;
		justify-items: center;
	}

	.onboarding {
		display: flex;
		flex-direction: column;
		gap: var(--gap);
		width: 100%;
		max-width: 28rem;
		padding-block: 5rem;
		padding-inline: var(--gap-large);
		font-size: var(--text-small);
		color: #000;
	}

	.step-label {
		font-size: 0.6875rem;
		letter-spacing: 0.06em;
		color: #666;
	}

	.step {
		display: flex;
		flex-direction: column;
		gap: var(--gap);

		&[hidden] {
			display: none;
		}
	}

	.title {
		font-size: var(--text-large);
		font-weight: bold;
	}

	.subtitle {
		color: #666;
		margin-block-end: 0.5rem;
	}

	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		border: none;
		padding: 0;
		margin: 0;
		min-width: 0;

		& > span,
		& > legend {
			font-size: 0.6875rem;
			letter-spacing: 0.04em;
			padding: 0;
		}

		& em {
			font-style: normal;
			color: #999;
			text-transform: none;
			letter-spacing: 0;
			margin-inline-start: 0.25rem;
		}
	}

	input:not([type='radio']),
	select,
	textarea {
		font: inherit;
		padding: 0.5rem 0.625rem;
		border: 1px solid #eaeaea;
		border-radius: 6px;
		background: #fff;
		color: #000;
		transition: border-color 150ms ease;

		&:hover {
			border-color: #999;
		}

		&:focus-visible {
			outline: none;
			border-color: #000;
			box-shadow: 0 0 0 1px #000;
		}
	}

	textarea {
		resize: vertical;
		line-height: 1.5;
	}

	/* online / in person / both */
	.segmented {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		border: 1px solid #eaeaea;
		border-radius: 6px;
		padding: 2px;
		gap: 2px;

		& label {
			position: relative;
			cursor: pointer;
		}

		& input {
			position: absolute;
			opacity: 0;
			pointer-events: none;
		}

		& span {
			display: block;
			text-align: center;
			padding: 0.375rem;
			border-radius: 4px;
			color: #666;
			transition:
				background 150ms ease,
				color 150ms ease;
		}

		& label:hover span {
			color: #000;
		}

		& input:checked + span {
			background: #000;
			color: #fff;
		}

		& input:focus-visible + span {
			outline: 2px solid #0070f3;
			outline-offset: 1px;
		}
	}

	.error {
		color: #e00;
		font-size: 0.75rem;
	}

	.hint {
		color: #666;
		font-size: 0.75rem;
	}

	.actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-block-start: 0.5rem;
	}

	.back {
		font: inherit;
		background: none;
		border: none;
		color: #666;
		cursor: pointer;
		padding: 0.5rem 0;

		&:hover {
			color: #000;
		}
	}
</style>
