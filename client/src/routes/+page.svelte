<script lang="ts">
	import Button from '$lib/components/basic/Button.svelte';
	import { goto } from '$app/navigation';
	import HeroIcon from '$lib/components/branding/HeroIcon.svelte';

	function redirectToTutors() {
		goto('/tutors');
	}
</script>

<svelte:head>
	<title>The Mind Club</title>
</svelte:head>

<div class="wrapper">
	<div class="landing-page">
		<div class="title">
			<span> Tutoring Services that work for you</span>
			<div class="buttons">
				<Button style="border-radius: 0.7rem;" directive="theme">Browse Tutors</Button>
				<Button style="border-radius: 0.7rem;">Get Started</Button>
			</div>
		</div>
		<div class="hero">
			<HeroIcon />
		</div>
		<div class="extra">
			<span>Learn better with us</span>
		</div>
	</div>
</div>

<style>
	.wrapper {
		width: 100%;
		padding: 1rem;
		display: flex;
	}

	.landing-page {
		display: grid;
		min-height: 70dvh;
		grid-template-columns: repeat(3, 1fr);

		> * {
			display: flex;
			align-items: center;
			justify-content: center;
			flex-direction: column;
		}

		& > .title {
			font-size: 1.75rem;

			& > .buttons {
				margin-block-start: 1rem;
				display: flex;
				gap: 1rem;
				justify-content: start;
				align-self: flex-start;
			}
		}
	}
</style>
