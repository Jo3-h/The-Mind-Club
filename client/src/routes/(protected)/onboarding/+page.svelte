<!--
	Onboarding — one form, several steps.
	Every step for the chosen role stays in the DOM (hidden when inactive) so a single
	POST carries everything. On fail(400) the page reopens at the first step with an error.

	Expects from load:  data.firstName?: string, data.curriculum: CurriculumGroup[]
	Expects from action (on failure): OnboardingFormResult  { values, fieldErrors }
	On success the action redirects: student → /onboarding/matches, tutor → /account.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount, tick, untrack } from 'svelte';
	import Button from '$lib/components/basic/Button.svelte';
	import AccountTypePicker from '$lib/components/auth/AccountTypePicker.svelte';
	import TopicPicker from '$lib/components/onboarding/TopicPicker.svelte';
	import AvailabilityGrid from '$lib/components/onboarding/AvailabilityGrid.svelte';
	import GroupSizeStepper from '$lib/components/onboarding/GroupSizeStepper.svelte';
	import RadioCards from '$lib/components/onboarding/RadioCards.svelte';
	import {
		STATES,
		YEAR_LEVELS,
		TEACHING_MODES,
		TEACHING_MODE_LABELS,
		POSTCODE_DIGITS,
		POSTCODE_PATTERN
	} from '$lib/constants/profile';
	import {
		DELIVERY_PREFERENCES,
		GROUP_PREFERENCES,
		GROUP_SIZE_DEFAULT,
		TRAVEL_RADII,
		STUDENT_FIELD_STEP,
		TUTOR_FIELD_STEP,
		BIO_LENGTH,
		HEADLINE_LENGTH,
		SCHOOL_LENGTH,
		WWCC_NUMBER_LENGTH
	} from '$lib/constants/onboarding';
	import { TUTOR_HOURLY_RATE_CENTS } from '$lib/constants/pricing';
	import { dollarsToCents, formatCents } from '$lib/utils/money';
	import { parseWindows } from '$lib/utils/time';
	import type {
		AvailabilityWindow,
		CurriculumGroup,
		DeliveryPreference,
		GroupPreference,
		OnboardingFormResult
	} from '$lib/types/onboarding';

	let {
		data,
		form
	}: {
		data: { firstName?: string | null; curriculum: CurriculumGroup[] };
		form: OnboardingFormResult | null;
	} = $props();

	// ---------- restore from a failed submit ----------
	const v = (key: string): string => {
		const raw = form?.values?.[key];
		return Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '');
	};
	const vs = (key: string): string[] => {
		const raw = form?.values?.[key];
		return Array.isArray(raw) ? raw : raw ? [raw] : [];
	};
	const err = (key: string) => form?.fieldErrors?.[key];

	// ---------- shared ----------
	let accountType = $state<'student' | 'tutor' | ''>(
		(v('accountType') as 'student' | 'tutor') || ''
	);
	let step = $state(1);
	let submitting = $state(false);
	let headingEl = $state<HTMLElement | null>(null);
	/** The browser's IANA zone, so weekly availability is stored in the right local time. */
	let timezone = $state('');
	onMount(() => {
		timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
	});

	let stateCode = $state(v('state'));
	let postcode = $state(v('postcode'));
	let topicIds = $state<string[]>(vs('topicIds'));
	let availability = $state<AvailabilityWindow[]>(parseWindows(v('availability')));

	// ---------- student ----------
	let yearLevel = $state(v('yearLevel'));
	let school = $state(v('school'));
	let deliveryPreference = $state<DeliveryPreference | ''>(
		(v('deliveryPreference') as DeliveryPreference) || ''
	);
	let groupPreference = $state<GroupPreference | ''>(
		(v('groupPreference') as GroupPreference) || 'any'
	);

	// ---------- tutor ----------
	let headline = $state(v('headline'));
	let bio = $state(v('bio'));
	let wwccNumber = $state(v('wwccNumber'));
	let teachingMode = $state(v('teachingMode'));
	let maxGroupSize = $state(Number(v('maxGroupSize')) || GROUP_SIZE_DEFAULT);
	let baseRate = $state(v('baseRate'));
	const baseRateCents = $derived(dollarsToCents(baseRate));
	const baseRateValid = $derived(
		baseRateCents !== null &&
			baseRateCents >= TUTOR_HOURLY_RATE_CENTS.MIN &&
			baseRateCents <= TUTOR_HOURLY_RATE_CENTS.MAX
	);
	let travelRadiusKm = $state(v('travelRadiusKm') || String(TRAVEL_RADII[1]));

	// ---------- derived ----------
	const totalSteps = $derived(accountType === 'tutor' ? 5 : 4);
	const isLastStep = $derived(step === totalSteps);

	const studentNeedsPostcode = $derived(
		deliveryPreference === 'in_person' || deliveryPreference === 'either'
	);
	const tutorNeedsPostcode = $derived(!!teachingMode && teachingMode !== 'online');

	/** Chapters a student can pick: their year, national lists + their state's courses. */
	const studentGroups = $derived(
		data.curriculum.filter(
			(g) => String(g.yearLevel) === yearLevel && (g.state === null || g.state === stateCode)
		)
	);
	/** Chapters a tutor can pick: all years, national lists + their state's courses. */
	const tutorGroups = $derived(
		data.curriculum.filter((g) => g.state === null || g.state === stateCode)
	);
	const offeredYears = $derived(
		[...new Set(data.curriculum.map((g) => g.yearLevel))].sort((a, b) => a - b)
	);

	const canContinue = $derived.by(() => {
		if (step === 1) return !!accountType;
		if (accountType === 'student') {
			switch (step) {
				case 2:
					return !!yearLevel && !!stateCode;
				case 3:
					return topicIds.length > 0;
				case 4:
					return (
						availability.length > 0 &&
						!!deliveryPreference &&
						!!groupPreference &&
						(!studentNeedsPostcode || POSTCODE_PATTERN.test(postcode))
					);
			}
		}
		if (accountType === 'tutor') {
			switch (step) {
				case 2:
					return headline.trim().length > 0 && bio.trim().length > 0 && !!stateCode;
				case 3:
					return topicIds.length > 0;
				case 4:
					return (
						baseRateValid &&
						!!teachingMode &&
						(!tutorNeedsPostcode || POSTCODE_PATTERN.test(postcode))
					);
				case 5:
					return availability.length > 0;
			}
		}
		return false;
	});

	// ---------- navigation ----------
	async function goTo(next: number) {
		// changing year/state can make earlier picks invalid — drop any that no longer apply
		if (step === 2 && next === 3) {
			const groups = accountType === 'student' ? studentGroups : tutorGroups;
			const allowed = new Set(groups.flatMap((g) => g.topics.map((t) => t.id)));
			topicIds = topicIds.filter((id) => allowed.has(id));
		}
		step = next;
		await tick();
		window.scrollTo({ top: 0, behavior: 'smooth' });
		headingEl?.focus({ preventScroll: true });
	}

	function onFormKeydown(e: KeyboardEvent) {
		// Enter on an earlier step advances instead of submitting the whole form
		if (e.key !== 'Enter' || isLastStep) return;
		if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
		e.preventDefault();
		if (canContinue) goTo(step + 1);
	}

	// after a failed submit, reopen at the first step that has an error
	// (only re-runs when `form` changes, not when the user later edits the role)
	$effect(() => {
		const errors = form?.fieldErrors;
		if (!errors) return;
		untrack(() => {
			if (!accountType) return;
			const map = accountType === 'tutor' ? TUTOR_FIELD_STEP : STUDENT_FIELD_STEP;
			const steps = Object.keys(errors)
				.filter((k) => errors[k])
				.map((k) => map[k])
				.filter(Boolean);
			step = steps.length ? Math.min(...steps) : totalSteps;
		});
	});
</script>

<svelte:head><title>Get started · The Mind Club</title></svelte:head>

<div class="onboarding-page">
	<div class="onboarding">
		<div class="progress" aria-hidden="true">
			{#each Array.from({ length: totalSteps }, (_, i) => i + 1) as n (n)}
				<span class="segment" class:done={n <= step}></span>
			{/each}
		</div>
		<span class="step-label">STEP {step} OF {totalSteps}</span>

		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<form
			method="post"
			novalidate
			onkeydown={onFormKeydown}
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update({ reset: false });
					submitting = false;
				};
			}}
		>
			<input type="hidden" name="timezone" value={timezone} />

			<!-- ================= STEP 1 · ROLE ================= -->
			<section class="step" hidden={step !== 1}>
				{#if step === 1}
					<h1 class="title" bind:this={headingEl} tabindex="-1">
						Welcome{data.firstName ? `, ${data.firstName}` : ''}
					</h1>
				{/if}
				<p class="subtitle">How will you be using The Mind Club?</p>
				<AccountTypePicker bind:value={accountType} />
			</section>

			<!-- ================= STUDENT ================= -->
			{#if accountType === 'student'}
				<!-- STEP 2 · STUDIES -->
				<section class="step" hidden={step !== 2}>
					{#if step === 2}
						<h1 class="title" bind:this={headingEl} tabindex="-1">About your studies</h1>
					{/if}
					<p class="subtitle">We use this to show you the right chapters and tutors.</p>

					<div class="row">
						<label class="field">
							<span>YEAR LEVEL</span>
							<select name="yearLevel" bind:value={yearLevel}>
								<option value="" disabled>Select year</option>
								{#each YEAR_LEVELS as y (y)}
									<option value={String(y)}>Year {y}</option>
								{/each}
							</select>
							{#if err('yearLevel')}<small class="error">{err('yearLevel')}</small>{/if}
						</label>

						<label class="field">
							<span>STATE</span>
							<select name="state" bind:value={stateCode}>
								<option value="" disabled>Select</option>
								{#each STATES as s (s)}
									<option value={s}>{s}</option>
								{/each}
							</select>
							{#if err('state')}<small class="error">{err('state')}</small>{/if}
						</label>
					</div>

					<label class="field">
						<span>SCHOOL <em>optional</em></span>
						<input
							name="school"
							maxlength={SCHOOL_LENGTH.MAX}
							bind:value={school}
							placeholder="e.g. Adelaide High School"
						/>
					</label>
				</section>

				<!-- STEP 3 · TOPICS -->
				<section class="step" hidden={step !== 3}>
					{#if step === 3}
						<h1 class="title" bind:this={headingEl} tabindex="-1">What do you need help with?</h1>
					{/if}
					<p class="subtitle">
						Pick the chapters you're working on or finding tricky. You can change these any time.
					</p>

					<TopicPicker
						groups={studentGroups}
						bind:selected={topicIds}
						emptyMessage={offeredYears.includes(Number(yearLevel))
							? `We don't have Year ${yearLevel} chapters for ${stateCode} yet.`
							: `We're starting with Years ${offeredYears.join(', ')}. More years are coming soon.`}
					/>
					{#if err('topicIds')}<small class="error">{err('topicIds')}</small>{/if}
					{#if topicIds.length > 0}
						<p class="hint">
							{topicIds.length} chapter{topicIds.length === 1 ? '' : 's'} selected
						</p>
					{/if}
				</section>

				<!-- STEP 4 · AVAILABILITY & PREFERENCES -->
				<section class="step" hidden={step !== 4}>
					{#if step === 4}
						<h1 class="title" bind:this={headingEl} tabindex="-1">When are you free?</h1>
					{/if}
					<p class="subtitle">
						Mark the times you could do a session. We'll match you with tutors and groups that fit.
					</p>

					<AvailabilityGrid bind:value={availability} />
					{#if err('availability')}<small class="error">{err('availability')}</small>{/if}

					<fieldset class="field">
						<legend>ONLINE OR IN PERSON?</legend>
						<div class="segmented">
							{#each DELIVERY_PREFERENCES as d (d.value)}
								<label>
									<input
										type="radio"
										name="deliveryPreference"
										value={d.value}
										bind:group={deliveryPreference}
									/>
									<span>{d.label}</span>
								</label>
							{/each}
						</div>
						{#if err('deliveryPreference')}
							<small class="error">{err('deliveryPreference')}</small>
						{/if}
					</fieldset>

					{#if studentNeedsPostcode}
						<label class="field">
							<span>YOUR POSTCODE</span>
							<input
								name="postcode"
								inputmode="numeric"
								maxlength={POSTCODE_DIGITS}
								bind:value={postcode}
								placeholder="5000"
							/>
							<small class="hint">So we only suggest in-person tutors near you.</small>
							{#if err('postcode')}<small class="error">{err('postcode')}</small>{/if}
						</label>
					{/if}

					<fieldset class="field">
						<legend>GROUP SIZE</legend>
						<RadioCards
							name="groupPreference"
							options={GROUP_PREFERENCES}
							bind:value={groupPreference}
						/>
						{#if err('groupPreference')}
							<small class="error">{err('groupPreference')}</small>
						{/if}
					</fieldset>
				</section>
			{/if}

			<!-- ================= TUTOR ================= -->
			{#if accountType === 'tutor'}
				<!-- STEP 2 · PROFILE -->
				<section class="step" hidden={step !== 2}>
					{#if step === 2}
						<h1 class="title" bind:this={headingEl} tabindex="-1">Your tutor profile</h1>
					{/if}
					<p class="subtitle">Students see this when browsing. You can edit it later.</p>

					<label class="field">
						<span>HEADLINE</span>
						<input
							name="headline"
							maxlength={HEADLINE_LENGTH.MAX}
							bind:value={headline}
							placeholder="e.g. Maths Methods tutor, 99.5 ATAR"
						/>
						{#if err('headline')}<small class="error">{err('headline')}</small>{/if}
					</label>

					<label class="field">
						<span>BIO</span>
						<textarea
							name="bio"
							rows="4"
							maxlength={BIO_LENGTH.MAX}
							bind:value={bio}
							placeholder="What you teach, your experience, and how you run a session"></textarea>
						<small class="hint counter">{bio.length}/{BIO_LENGTH.MAX}</small>
						{#if err('bio')}<small class="error">{err('bio')}</small>{/if}
					</label>

					<label class="field">
						<span>STATE</span>
						<select name="state" bind:value={stateCode}>
							<option value="" disabled>Select</option>
							{#each STATES as s (s)}
								<option value={s}>{s}</option>
							{/each}
						</select>
						<small class="hint"
							>Senior courses are state-specific, so this sets what you can teach.</small
						>
						{#if err('state')}<small class="error">{err('state')}</small>{/if}
					</label>

					<label class="field">
						<span>WORKING WITH CHILDREN CHECK <em>optional for now</em></span>
						<input
							name="wwccNumber"
							maxlength={WWCC_NUMBER_LENGTH.MAX}
							bind:value={wwccNumber}
							autocomplete="off"
						/>
						<small class="hint"
							>Required before you can publish sessions with students under 18.</small
						>
						{#if err('wwccNumber')}<small class="error">{err('wwccNumber')}</small>{/if}
					</label>
				</section>

				<!-- STEP 3 · WHAT YOU TEACH -->
				<section class="step" hidden={step !== 3}>
					{#if step === 3}
						<h1 class="title" bind:this={headingEl} tabindex="-1">What can you teach?</h1>
					{/if}
					<p class="subtitle">
						Tick a whole course to teach every chapter, or open it to pick chapters. This is what we
						match students on.
					</p>

					<TopicPicker
						groups={tutorGroups}
						bind:selected={topicIds}
						searchable
						emptyMessage="Pick your state on the previous step to see courses."
					/>
					{#if err('topicIds')}<small class="error">{err('topicIds')}</small>{/if}
					{#if topicIds.length > 0}
						<p class="hint">
							{topicIds.length} chapter{topicIds.length === 1 ? '' : 's'} selected
						</p>
					{/if}
				</section>

				<!-- STEP 4 · HOW YOU RUN SESSIONS -->
				<section class="step" hidden={step !== 4}>
					{#if step === 4}
						<h1 class="title" bind:this={headingEl} tabindex="-1">How you run sessions</h1>
					{/if}
					<p class="subtitle">
						Students starting a session can choose any group size up to your limit.
					</p>

					<label class="field">
						<span>HOURLY RATE (1 STUDENT, 60 MIN)</span>
						<input
							name="baseRate"
							inputmode="decimal"
							bind:value={baseRate}
							placeholder="e.g. 70"
							aria-describedby="base-rate-hint"
						/>
						<small class="hint" id="base-rate-hint">
							Between {formatCents(TUTOR_HOURLY_RATE_CENTS.MIN)} and {formatCents(
								TUTOR_HOURLY_RATE_CENTS.MAX
							)}. Each student pays less as the group grows.
						</small>
						{#if baseRate && !baseRateValid}
							<small class="error">
								Enter an amount from {formatCents(TUTOR_HOURLY_RATE_CENTS.MIN)} to {formatCents(
									TUTOR_HOURLY_RATE_CENTS.MAX
								)}
							</small>
						{:else if err('baseRate')}
							<small class="error">{err('baseRate')}</small>
						{/if}
					</label>

					<fieldset class="field">
						<legend>LARGEST GROUP YOU'LL TAKE</legend>
						<GroupSizeStepper bind:value={maxGroupSize} />
						{#if err('maxGroupSize')}<small class="error">{err('maxGroupSize')}</small>{/if}
					</fieldset>

					<fieldset class="field">
						<legend>HOW DO YOU TEACH?</legend>
						<div class="segmented">
							{#each TEACHING_MODES as m (m)}
								<label>
									<input type="radio" name="teachingMode" value={m} bind:group={teachingMode} />
									<span>{TEACHING_MODE_LABELS[m]}</span>
								</label>
							{/each}
						</div>
						{#if err('teachingMode')}<small class="error">{err('teachingMode')}</small>{/if}
					</fieldset>

					{#if tutorNeedsPostcode}
						<div class="row">
							<label class="field">
								<span>POSTCODE</span>
								<input
									name="postcode"
									inputmode="numeric"
									maxlength={POSTCODE_DIGITS}
									bind:value={postcode}
									placeholder="5000"
								/>
								{#if err('postcode')}<small class="error">{err('postcode')}</small>{/if}
							</label>

							<label class="field">
								<span>WILL TRAVEL</span>
								<select name="travelRadiusKm" bind:value={travelRadiusKm}>
									{#each TRAVEL_RADII as r (r)}
										<option value={String(r)}>Up to {r} km</option>
									{/each}
								</select>
								{#if err('travelRadiusKm')}
									<small class="error">{err('travelRadiusKm')}</small>
								{/if}
							</label>
						</div>
					{/if}
				</section>

				<!-- STEP 5 · AVAILABILITY -->
				<section class="step" hidden={step !== 5}>
					{#if step === 5}
						<h1 class="title" bind:this={headingEl} tabindex="-1">When can students book you?</h1>
					{/if}
					<p class="subtitle">
						Mark your usual weekly hours. Students propose a start time inside these windows.
					</p>

					<AvailabilityGrid bind:value={availability} />
					{#if err('availability')}<small class="error">{err('availability')}</small>{/if}
				</section>
			{/if}

			{#if form?.fieldErrors?.form}
				<p class="error form-error" role="alert">{form.fieldErrors.form}</p>
			{/if}

			<!-- ================= ACTIONS ================= -->
			<div class="actions">
				{#if step > 1}
					<button type="button" class="back" onclick={() => goTo(step - 1)}>Back</button>
				{:else}
					<span></span>
				{/if}

				{#if isLastStep}
					<Button directive="theme" disabled={!canContinue || submitting}>
						{#if submitting}
							{accountType === 'student' ? 'Finding tutors…' : 'Setting up…'}
						{:else}
							{accountType === 'student' ? 'Find my tutors' : 'Finish setup'}
						{/if}
					</Button>
				{:else}
					<Button
						directive="theme"
						type="button"
						disabled={!canContinue}
						onclick={() => goTo(step + 1)}
					>
						Continue
					</Button>
				{/if}
			</div>
		</form>
	</div>
</div>

<style>
	.onboarding-page {
		display: grid;
		width: 100%;
		justify-items: center;
	}

	.onboarding {
		display: flex;
		flex-direction: column;
		gap: var(--gap);
		width: 100%;
		max-width: 30rem;
		padding-block: 4rem 5rem;
		padding-inline: var(--gap-large);
		font-size: var(--text-small);
		color: #000;
	}

	.progress {
		display: flex;
		gap: 0.25rem;
	}

	.segment {
		flex: 1;
		height: 2px;
		border-radius: 1px;
		background: #eaeaea;
		transition: background 200ms ease;

		&.done {
			background: #000;
		}
	}

	.step-label {
		font-size: 0.6875rem;
		letter-spacing: 0.06em;
		color: #666;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: var(--gap);
	}

	.step {
		display: flex;
		flex-direction: column;
		gap: var(--gap);

		&[hidden] {
			display: none;
		}
	}

	.title {
		font-size: var(--text-large);
		font-weight: bold;
		margin: 0;

		&:focus {
			outline: none;
		}
	}

	.subtitle {
		color: #666;
		margin: 0 0 0.5rem;
		line-height: 1.5;
	}

	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		border: none;
		padding: 0;
		margin: 0;
		min-width: 0;

		& > span,
		& > legend {
			font-size: 0.6875rem;
			letter-spacing: 0.04em;
			padding: 0;
			margin-block-end: 0.375rem;
		}

		& > span {
			margin-block-end: 0;
		}

		& em {
			font-style: normal;
			color: #999;
			text-transform: none;
			letter-spacing: 0;
			margin-inline-start: 0.25rem;
		}
	}

	input:not([type='radio']):not([type='checkbox']),
	select,
	textarea {
		font: inherit;
		padding: 0.5rem 0.625rem;
		border: 1px solid #eaeaea;
		border-radius: 6px;
		background: #fff;
		color: #000;
		transition: border-color 150ms ease;

		&:hover {
			border-color: #999;
		}

		&:focus-visible {
			outline: none;
			border-color: #000;
			box-shadow: 0 0 0 1px #000;
		}
	}

	textarea {
		resize: vertical;
		line-height: 1.5;
	}

	.counter {
		align-self: flex-end;
		font-variant-numeric: tabular-nums;
	}

	/* online / in person / both */
	.segmented {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		border: 1px solid #eaeaea;
		border-radius: 6px;
		padding: 2px;
		gap: 2px;

		& label {
			position: relative;
			cursor: pointer;
		}

		& input {
			position: absolute;
			opacity: 0;
			pointer-events: none;
		}

		& span {
			display: block;
			text-align: center;
			padding: 0.375rem;
			border-radius: 4px;
			color: #666;
			transition:
				background 150ms ease,
				color 150ms ease;
		}

		& label:hover span {
			color: #000;
		}

		& input:checked + span {
			background: #000;
			color: #fff;
		}

		& input:focus-visible + span {
			outline: 2px solid #0070f3;
			outline-offset: 1px;
		}
	}

	.error {
		color: #e00;
		font-size: 0.75rem;
	}

	.form-error {
		margin: 0;
	}

	.hint {
		color: #666;
		font-size: 0.75rem;
		margin: 0;
	}

	.actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-block-start: 0.5rem;
		padding-block-start: var(--gap);
		border-top: 1px solid #eaeaea;
	}

	.back {
		font: inherit;
		background: none;
		border: none;
		color: #666;
		cursor: pointer;
		padding: 0.5rem 0;

		&:hover {
			color: #000;
		}
	}

	@media (max-width: 420px) {
		.row {
			grid-template-columns: 1fr;
		}
	}
</style>
