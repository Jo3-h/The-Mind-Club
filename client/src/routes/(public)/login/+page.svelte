<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import GoogleButton from '$lib/components/auth/GoogleButton.svelte';
	import Button from '$lib/components/basic/Button.svelte';
	import { EmailSchema } from '$lib/schemas/auth/auth';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let email = $state('');
	let password = $state('');
	let errorMessage: string | null = $state(null);

	$effect(() => {
		void email;
		void password;
		errorMessage = null;
	});
</script>

<div class="login-page">
	<div class="login">
		<span class="title"> Login to your account</span>
		<span>Welcome back! Your groups and bookings are right where you left them.</span>
		<form
			class="login-form"
			method="post"
			action="?/signInEmail"
			use:enhance={({ cancel }) => {
				const parsedEmail = EmailSchema.safeParse(email);
				if (!parsedEmail.success) {
					errorMessage = parsedEmail.error.issues.flatMap((issue) => issue.message).join(', ');
					cancel();
				}
			}}
		>
			{#if data.redirectTo}
				<input type="hidden" name="redirectTo" value={data.redirectTo} />
			{/if}

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

			<Button directive="theme">Login</Button>
		</form>
		<span class="or"></span>
		<GoogleButton />
		<hr />
		<span>Don't have an account? <a href={resolve('/signup')}>Sign up here</a>.</span>
	</div>
</div>

<style>
	.login-page {
		display: grid;
		width: 100%;
		justify-items: center;

		& > .login {
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

		.or {
			text-align: center;
			margin-block: 1rem;
		}

		.login-form {
			display: flex;
			flex-direction: column;
			gap: var(--gap);
			margin-block-start: 1rem;

			& > input {
				margin-block-end: var(--gap);
				padding: var(--gap);

				&:focus {
					outline: 2px solid var(--emerald);
				}
			}
		}
	}

	hr {
		border: 0;
		height: 1px;
		background: var(--grey);
		width: 100%;
	}
</style>
