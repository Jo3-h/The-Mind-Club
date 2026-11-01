<script lang="ts">
	type AccountType = 'student' | 'tutor' | '';

	let { value = $bindable<AccountType>(''), name = 'accountType' } = $props();

	const options = [
		{ value: 'student', title: 'Student', desc: 'Find tutors and book sessions' },
		{ value: 'tutor', title: 'Tutor', desc: 'Run sessions and grow your classes' }
	] as const;
</script>

<fieldset class="account-type">
	<legend class="sr-only">Choose your account type</legend>
	{#each options as opt (opt.value)}
		<label class="option">
			<input type="radio" {name} value={opt.value} bind:group={value} />
			<span class="option-head">
				<span class="option-title">{opt.title}</span>
				<span class="indicator" aria-hidden="true"></span>
			</span>
			<span class="option-desc">{opt.desc}</span>
		</label>
	{/each}
</fieldset>

<style>
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
		margin: 0;
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
		transition: border 150ms ease;
	}

	.option:has(input:checked) .indicator {
		border: 4px solid #000;
	}
</style>
