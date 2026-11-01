<script lang="ts">
	import { enhance } from '$app/forms';
	import GoogleButton from '$lib/components/auth/GoogleButton.svelte';
	import Button from '$lib/components/basic/Button.svelte';
	import { SignupSchema } from '$lib/schemas/auth/auth';

	let email = $state('');
	let password = $state('');
	let accountType = $state('');
	let name = $state('');

	let errorMessage: string | null = $state(null);

	$effect(() => {
		email;
		password;
		name;
		errorMessage = null;
	});
</script>

<div class="signup-page">
	<div class="signup">
		<span class="title">Signup for an account</span>
		<span>Welcome back! Your groups and bookings are right where you left them.</span>
		<form
			class="login-form"
			method="post"
			action="?/signUp"
			use:enhance={({ cancel }) => {
				const parsed = SignupSchema.safeParse({
					email,
					password,
					name,
					accountType
				});
				if (!parsed.success) {
					errorMessage = parsed.error.issues.flatMap((issue) => issue.message).join(', ');
					console.log({
						email,
						password,
						name,
						accountType
					});
					cancel();
				}
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

			{#if errorMessage}
				<p class="error" role="alert">{errorMessage}</p>
			{/if}

			<Button directive="theme">Signup</Button>
		</form>
		<GoogleButton />
		<hr />
		<span>Already have an account? <a href="/login">Login here</a>.</span>
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

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.account-type {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
		border: none;
		padding: 0;
		margin: 0 0 var(--gap);
	}

	.option {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.75rem;
		border: 1px solid #eaeaea;
		border-radius: 6px;
		background: #fff;
		cursor: pointer;
		transition:
			border-color 150ms ease,
			box-shadow 150ms ease;

		&:hover {
			border-color: #999;
		}

		/* hide the native radio but keep it focusable */
		& > input {
			position: absolute;
			opacity: 0;
			pointer-events: none;
		}

		&:has(input:checked) {
			border-color: #000;
			box-shadow: 0 0 0 1px #000;
		}

		&:has(input:focus-visible) {
			outline: 2px solid #0070f3;
			outline-offset: 2px;
		}
	}

	.option-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.option-title {
		font-weight: 600;
		color: #000;
	}

	.option-desc {
		color: #666;
		font-size: 0.75rem;
		line-height: 1.4;
	}

	.indicator {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: 1px solid #ccc;
		transition: all 150ms ease;

		.option:has(input:checked) & {
			border: 4px solid #000;
		}
	}
</style>
