<script lang="ts">
	import type { PageData } from './$types';
	import { STUDENT_ACCOUNT_TYPE, TUTOR_ACCOUNT_TYPE } from '$lib/schemas/auth/auth';

	let { data }: { data: PageData } = $props();
</script>

{#if data.user}
	<div class="account-page">
		<h1>Account Page</h1>
		{#if data.user}
			<p>Welcome, {data.user.name}!</p>
		{:else if data.user === null}
			<p>Please log in to access your account.</p>
		{/if}

		{#if data.user.role === STUDENT_ACCOUNT_TYPE}
			<p>Account Type: Student</p>
		{:else if data.user.role === TUTOR_ACCOUNT_TYPE}
			<p>Account Type: Tutor</p>
		{/if}
	</div>
{/if}

<style>
	.account-page {
		padding: 2rem;
	}
</style>
