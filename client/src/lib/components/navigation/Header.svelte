<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Button from '../basic/Button.svelte';
	import HeroIcon from '../branding/HeroIcon.svelte';

	interface Props {
		user: App.Locals['user'];
	}
	const { user }: Props = $props();
</script>

<header>
	<a href={resolve('/')}>
		<HeroIcon size="3rem" --fg="#000000" />
	</a>

	<div class="nav-items">
		<a class="nav-link" href={resolve('/tutors')}>Find a tutor</a>
		{#if user}
			<a class="nav-link" href={resolve('/sessions')}>My sessions</a>
			<p>Welcome, {user.name}!</p>

			<form method="post" action="/?/signOut" use:enhance>
				<Button>
					<span>Logout</span>
				</Button>
			</form>
		{:else}
			<a href={resolve('/login')}>
				<span>Login</span>
			</a>
			<a href={resolve('/signup')}>
				<Button variant="primary">
					<span>Signup</span>
				</Button>
			</a>
		{/if}
	</div>
</header>

<style>
	header {
		padding: 0.5rem var(--gap-large);
		display: flex;
		flex-direction: row;
		gap: space-between;
		border-bottom: 1px solid var(--gray);

		a {
			text-decoration: none;
		}

		.nav-items {
			display: flex;
			margin-left: auto;
			align-items: center;
			justify-content: flex-end;
			gap: var(--gap-large);

			a {
				color: var(--darker-grey);
				font-weight: bold;
				transition: color 120ms ease;
			}

			a:hover {
				color: var(--darkest-grey);
			}
		}
	}
</style>
