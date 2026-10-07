<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/basic/Button.svelte';
	import { EmailSchema } from '$lib/schemas/auth';

	let email = $state('');
	let password = $state('');
	let errorMessage: string | null = $state(null);

	$effect(() => {
		email;
		password;
		errorMessage = null;
	});
</script>

<div class="login-page">
	<div class="landing">
		<span class="annotation">{'The Mind Club'.toUpperCase()}</span>
		<span class="title">An account is only for booking, paying, and keeping records.</span>
		<hr />
		<span>Payments handled by <span>Stripe</span> - we never store card details!</span>
		<hr />
		<span>Parents can hold the account and add a student under 16.</span>
		<hr />
		<span>Every receipt shows the rung you paid and any refund issued.</span>
		<hr />
		<div style="margin-top: auto; font-size: var(--text-small);">
			<span>Belief . Commitment . Integrity</span>
		</div>
	</div>
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

			<Button>Login</Button>
		</form>
		<hr />
		<span>Don't have an account? <a href="/signup">Sign up here</a>.</span>
	</div>
</div>

<style>
	.login-page {
		display: grid;
		width: 100%;
		grid-template-columns: 1fr 1fr;
		justify-items: center;

		& > .landing {
			background-color: var(--darkest-blue);
			padding-block: 5rem 1rem;
			padding-inline: var(--gap-large);
			display: flex;
			flex-direction: column;
			gap: var(--gap);
			color: var(--lightest-blue);
			font-size: var(--text-medium);

			& > .annotation {
				font-size: var(--text-small);
			}

			& > .title {
				font-size: var(--text-title);
				font-weight: bold;
			}

			& > span {
				& > span {
					font-style: italic;
				}
			}
		}

		& > .login {
			padding-block: 5rem;
			padding-inline: var(--gap-large);
			display: flex;
			max-width: 25rem;
			flex-direction: column;
			gap: var(--gap);
			font-size: var(--text-small);
			color: var(--darkest-blue);

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

		a {
			color: var(--light-orange);
		}
		a:hover {
			color: var(--light-orange);
			text-decoration: underline;
			cursor: pointer;
		}
	}

	hr {
		border: 0;
		height: 1px;
		background: var(--lightest-blue);
		width: 100%;
	}
</style>
