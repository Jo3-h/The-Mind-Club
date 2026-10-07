<script lang="ts">
	import { enhance } from '$app/forms';
	import Box from '../basic/Box.svelte';
	import Button from '../basic/Button.svelte';

	interface Props {
		user: App.Locals['user'];
	}
	const { user }: Props = $props();
</script>

<header>
	<a href={user ? '/dashboard' : '/'}>
		<span class="header-title">The Mind Club</span>
	</a>

	<div class="nav-items">
		{#if user}
			<p>Welcome, {user.name}!</p>

			<form method="post" action="/?/signOut" use:enhance>
				<Button>
					<span>Logout</span>
				</Button>
			</form>
		{:else}
			<a href="/login">
				<Button>
					<span>Login</span>
				</Button>
			</a>
			<a href="/signup">
				<Button>
					<span>Signup</span>
				</Button>
			</a>
		{/if}
	</div>
</header>

<style>
	header {
		padding: 0.5rem;
		display: flex;
		flex-direction: row;
		gap: space-between;
		border-bottom: 1px solid var(--dark-blue);

		a {
			text-decoration: none;
		}

		.header-title {
			font-style: italic;
			margin-inline: var(--gap);
			font-weight: bold;
			font-size: 2rem;
			color: var(--light-orange);
			white-space: nowrap;
		}

		.nav-items {
			display: flex;
			margin-left: auto;
			align-items: center;
			justify-content: flex-end;
			gap: 0.5rem;
		}
	}
</style>
