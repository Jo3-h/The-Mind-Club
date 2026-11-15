<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import GoogleButton from '$lib/components/auth/GoogleButton.svelte';
	import Button from '$lib/components/basic/Button.svelte';
	import { SignupSchema } from '$lib/schemas/auth/auth';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();

	let email = $state('');
	let password = $state('');
	let name = $state('');

	let errorMessage: string | null = $state(null);
	let submitting = $state(false);

	// clear the error as soon as they edit a field
	$effect(() => {
		void email;
		void password;
		void name;
		errorMessage = null;
	});
</script>

<div class="signup-page">
	<div class="signup">
		<span class="title">Create your account</span>
		<span>Next, we'll ask whether you're a student or a tutor.</span>
		<form
			class="login-form"
			method="post"
			action="?/signUp"
			use:enhance={({ cancel }) => {
				const parsed = SignupSchema.safeParse({ email, password, name });
				if (!parsed.success) {
					errorMessage = parsed.error.issues.map((issue) => issue.message).join(', ');
					cancel();
					return;
				}
				submitting = true;
				return async ({ result, update }) => {
					submitting = false;
					if (result.type === 'failure') {
						errorMessage = (result.data as { message?: string })?.message ?? 'Could not sign up';
						return;
					}
					await update();
				};
			}}
		>
			<span>NAME</span>
			<input name="name" type="name" placeholder="name" bind:value={name} required />

			<span>EMAIL</span>
			<input
				name="email"
				type="email"
				placeholder="example@domain.com"
				bind:value={email}
				required
			/>

			<span>PASSWORD</span>
			<input
				style="margin-block-end: 1rem;"
				name="password"
				type="password"
				bind:value={password}
				placeholder="secure-password-recommended"
				required
			/>

			{#if errorMessage ?? form?.message}
				<p class="error" role="alert">{errorMessage ?? form?.message}</p>
			{/if}

			<Button directive="theme" disabled={submitting}>
				{submitting ? 'Creating account…' : 'Sign up'}
			</Button>
		</form>
		<GoogleButton />
		<hr />
		<span>Already have an account? <a href={resolve('/login')}>Login here</a>.</span>
	</div>
</div>

<style>
	.signup-page {
		display: grid;
		width: 100%;
		justify-items: center;

		& > .signup {
			padding-block: 5rem;
			padding-inline: var(--gap-large);
			display: flex;
			max-width: 25rem;
			flex-direction: column;
			gap: var(--gap);
			font-size: var(--text-small);
			color: black;

			& > .title {
				font-size: var(--text-large);
				font-weight: bold;
			}
		}

		.login-form {
			display: flex;
			flex-direction: column;
			gap: var(--gap);
			margin-block: 1rem;

			& > input {
				margin-block-end: var(--gap);
				padding: var(--gap);
			}
		}
	}
</style>
