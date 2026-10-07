<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/basic/Button.svelte';
	import { SignupSchema } from '$lib/schemas/auth';

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
			<span>ACCOUNT TYPE</span>
			<fieldset>
				<legend>Choose your account type:</legend>
				<label>
					<input
						type="radio"
						name="accountType"
						value="student"
						bind:group={accountType}
						required
					/>
					Student
				</label>
				<label>
					<input type="radio" name="accountType" value="tutor" bind:group={accountType} required />
					Tutor
				</label>
			</fieldset>

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

			<Button>Signup</Button>
		</form>
		<hr />
		<span>Already have an account? <a href="/login">Login here</a>.</span>
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

		& > .signup {
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
