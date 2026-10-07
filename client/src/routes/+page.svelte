<script lang="ts">
	import Button from '$lib/components/basic/Button.svelte';
	import { goto } from '$app/navigation';

	function redirectToTutors() {
		goto('/tutors');
	}
</script>

<div class="landing-page">
	<div class="title-section">
		<div class="content">
			<span>GROUP TUTORING - REASONABLE PRICING</span>
			<span>Connecting Students with Tutors, Anytime, Anywhere.</span>
			<span
				>One student opens a session and sets the group size and format. Every student who joins
				after moves the whole group down a published price ladder — and everyone settles at the same
				final rate.</span
			>
			<div class="nav-buttons">
				<Button style="padding: var(--gap) 2rem" colour="white" onclick={redirectToTutors}
					>Browse Tutors</Button
				>
				<Button style="padding: var(--gap) 2rem" colour="orange">Teach with us</Button>
			</div>
		</div>
	</div>
	<div class="display">
		<div></div>
	</div>
</div>

<style>
	.landing-page {
		display: grid;
		width: 100%;
		grid-template-columns: 1fr 1fr;
		min-height: 100dvh;

		& > .title-section {
			background-color: var(--lightest-orange);
			color: var(--darkest-orange);
			padding-inline: 2.5rem;
			padding-block: 5rem 1rem;

			& > .content {
				display: flex;
				flex-direction: column;

				& > :nth-child(1) {
					font-size: var(--text-fine);
					font-style: italic;
				}

				& > :nth-child(2) {
					font-size: var(--text-title);
					font-weight: bold;
					margin-block-end: var(--gap-large);
				}
				& > :nth-child(3) {
					font-size: var(--text-medium);
				}
			}
		}

		& > .display {
			padding: 10rem 5rem;
			& > div {
				border: 1px solid var(--darkest-blue);
				border-radius: var(--border-small);
				width: 100%;
				height: 100%;
			}
		}

		.nav-buttons {
			display: flex;
			width: 100%;
			gap: var(--gap);
			margin-block-start: var(--gap-large);
			justify-content: start;
			align-items: start;
		}
	}
</style>
