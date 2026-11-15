<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import {
		ADMIN_ACCOUNT_TYPE,
		STUDENT_ACCOUNT_TYPE,
		TUTOR_ACCOUNT_TYPE
	} from '$lib/constants/profile';
	import { MEETING_URL_MAX_LENGTH } from '$lib/constants/sessions';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const ROLE_LABEL: Record<string, string> = {
		[STUDENT_ACCOUNT_TYPE]: 'Student',
		[TUTOR_ACCOUNT_TYPE]: 'Tutor',
		[ADMIN_ACCOUNT_TYPE]: 'Admin'
	};
</script>

<svelte:head><title>Account · The Mind Club</title></svelte:head>

{#if data.user}
	<div class="account-page">
		<h1>Welcome, {data.user.name}</h1>

		{#if data.user.role === ADMIN_ACCOUNT_TYPE}
			<p>Account type: Admin</p>
		{:else if !data.isOnboarded}
			<div class="setup">
				<p>You haven't finished setting up your account yet.</p>
				<a href={resolve('/onboarding')}>Finish setting up →</a>
			</div>
		{:else}
			<p>Account type: {ROLE_LABEL[data.user.role] ?? data.user.role}</p>
			<a href={resolve('/sessions')}>Your sessions →</a>
			{#if data.user.role === STUDENT_ACCOUNT_TYPE}
				<a href={resolve('/onboarding/matches')}>See your tutor matches →</a>
			{/if}
			{#if data.user.role === TUTOR_ACCOUNT_TYPE}
				<form
					class="setup"
					method="POST"
					action="?/setMeetingLink"
					use:enhance={() =>
						async ({ update }) =>
							update({ reset: false })}
				>
					<label for="meetingUrl"><strong>Meeting link for online sessions</strong></label>
					<p class="muted">
						Your Zoom personal room, Google Meet, Teams or Whereby link. Students only reach it
						through the Join button on a session they're booked into.
					</p>
					<input
						id="meetingUrl"
						name="meetingUrl"
						type="url"
						inputmode="url"
						placeholder="https://zoom.us/j/…"
						maxlength={MEETING_URL_MAX_LENGTH}
						value={data.meetingUrl ?? ''}
					/>
					{#if form?.meetingError}<small class="error">{form.meetingError}</small>{/if}
					{#if form?.meetingSaved}<small class="saved">Saved.</small>{/if}
					<button type="submit">Save link</button>
				</form>
			{/if}
		{/if}
	</div>
{/if}

<style>
	.account-page {
		padding: 2rem;
		display: flex;
		flex-direction: column;
		gap: var(--gap);
	}

	h1 {
		margin: 0;
		font-family: 'Source Serif 4', serif;
		font-size: var(--text-large);
		font-weight: 600;
	}

	p {
		margin: 0;
	}

	.setup {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1rem;
		border: 1px solid var(--grey);
		border-radius: 8px;
		max-width: 28rem;
	}

	a {
		color: #1f4d45;
		font-weight: 500;
	}

	.muted {
		color: var(--tm-muted);
		font-size: 0.875rem;
	}

	input {
		font: inherit;
		padding: 0.5rem 0.625rem;
		border: 1px solid var(--tm-border);
		border-radius: 6px;
	}

	.error {
		color: #b42318;
	}

	.saved {
		color: var(--tm-green);
	}

	button {
		align-self: flex-start;
		padding: 0.5rem 0.875rem;
		border: 0;
		border-radius: 6px;
		background: var(--tm-green);
		color: #fff;
		font: inherit;
		font-weight: 500;
		cursor: pointer;

		&:hover {
			background: var(--tm-green-hover);
		}
	}
</style>
