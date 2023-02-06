<script lang="ts">
	import type {AccountPath} from '#/meta/account';
	
	import {onMount} from 'svelte';
	
	import {Screen} from './_screens';
	import {load_flow_context} from '../svelte';
	
	import type {Argon2Params, Argon2Worker} from '#/crypto/argon2';
	import {Argon2Type} from '#/crypto/argon2';
	import {load_argon_worker} from '#/crypto/argon2-host';
	
	import {Accounts} from '#/store/accounts';
	import {timeout} from '#/util/belt';
	import {buffer_to_base64, buffer_to_base93} from '#/util/data';
	
	import SolvedRedCard from './SolvedRedCard.svelte';
	import LoadingAnimation from '../frag/LoadingAnimation.svelte';
	import ActionsWall from '../ui/ActionsWall.svelte';
	
	import ProgressBar from '../ui/ProgressBar.svelte';

	import SX_ICON_RED_CARD from '#/icon/red-card.svg?raw';
	

	// flow complete callback
	const {
		k_page,
	} = load_flow_context<undefined>();

	function abort() {
		globalThis.close();
	}

	const atu8_challenge: Uint8Array = crypto.getRandomValues(new Uint8Array(32));

	const GC_ARGON_PROVER: Omit<Argon2Params, 'phrase' | 'salt'> = {
		type: Argon2Type.Argon2id,
		hashLen: 32,
		memory: 1 << 9,
		iterations: 4,
	};

	const N_GUESSES_PER_BATCH_INIT = 4;

	export let p_account: AccountPath;

	let x_progress = 0;

	let b_paused = false;

	let xt_init = 0;

	let c_batch_attempts = 0;

	let xtl_estimate = 0;

	let xtl_max = 0;

	let xtl_arrival = 0;

	const a_samples: [number, number][] = [];

	let b_kill_all = false;

	let xad_rotation = 0;
	let xc_direction = 1;

	const a_paused: VoidFunction[] = [];

	let c_guesses = 0;

	// set difficulty
	// const n_difficulty = 12;
	const n_difficulty = 9;

	const XTL_CONVERGE = 3e3;

	let s_pause_button = 'Pause';

	async function attempt(k_worker: Argon2Worker, i_worker: number, c_attempts=0, n_guess_per_batch=N_GUESSES_PER_BATCH_INIT) {
		if(b_paused) {
			a_paused.push(() => {
				void attempt(k_worker, i_worker, c_attempts, n_guess_per_batch);
			});

			console.log(`Paused #${i_worker}; ${a_paused.length} / ${a_workers.length} paused`);

			// set pause button label
			if(a_paused.length >= a_workers.length) s_pause_button = 'Paused';

			return;
		}

		const xt_start = performance.now();

		xtl_estimate = ((xt_start - xt_init) / c_guesses) * (2 ** n_difficulty);
		xtl_max = ((xt_start - xt_init) / c_guesses) * (2 ** (n_difficulty + 1));

		// allow svelte to update dom in case user is single-threaded
		await timeout(10);

		// 
		const atu8_result = await k_worker.attack({
			attempts: n_guess_per_batch,
			difficulty: n_difficulty,
			params: {
				...GC_ARGON_PROVER,
				phrase: atu8_challenge,
			},
		});

		// already done
		if(b_kill_all) return;

		// success
		if(atu8_result.length) {
			void succeed(atu8_result.slice(0, 32), atu8_result.slice(32));
			return;
		}

		const xtl_attempt = performance.now() - xt_start;

		c_guesses += n_guess_per_batch;

		// add the average time it took per guess to samples array, along with its relative weight
		a_samples.push([xtl_attempt / n_guess_per_batch, 1.001 - (1 / n_guess_per_batch)]);

		n_guess_per_batch = Math.max(2, Math.round((XTL_CONVERGE / xtl_attempt) * n_guess_per_batch));

		xad_rotation += (xc_direction * ((XTL_CONVERGE / xtl_attempt) * 30)) + (Math.random() * 10);

		if(1 === xc_direction) {
			xc_direction = 1.75;
		}
		else if(xc_direction > 1) {
			xc_direction = -1;
		}
		else {
			xc_direction *= -1;
		}

		console.debug(`Batch attempt @${i_worker} #${c_attempts} / ${c_batch_attempts++};New attempts per batch: ${n_guess_per_batch}`);

		// avoid adding to stack trace; retry
		setTimeout(() => {
			void attempt(k_worker, i_worker, c_attempts+1, n_guess_per_batch);
		}, 0);
	}

	let i_update = 0;
	let xtl_elapsed = 0;

	async function succeed(atu8_answer: Uint8Array, atu8_result: Uint8Array) {
		clearInterval(i_update);

		b_kill_all = true;

		for(const k_worker of a_workers) {
			k_worker.terminate();
		}

		x_progress = 1;

		// save to account
		await Accounts.update(p_account, _g_account => ({
			extra: {
				..._g_account.extra,
				redCard: {
					answer: buffer_to_base93(atu8_answer),
					result: buffer_to_base93(atu8_result),
				},
			},
		}));

		await timeout(500);

		k_page.push({
			creator: SolvedRedCard,
			props: {
				atu8_answer,
				atu8_result,
			},
		});

		console.debug(`Found answer: ${buffer_to_base64(atu8_answer)} => ${buffer_to_base64(atu8_result)}`
			+`\n${(new DataView(atu8_result.buffer).getUint32(0, false) >>> 0).toString(2).padStart(32, '0')}`);
	}

	const a_workers: Argon2Worker[] = [];

	let b_initd = false;

	async function start() {
		if(!a_workers.length) {
			for(let i_cpu=0; i_cpu<Math.max(1, (navigator.hardwareConcurrency || 1) - 0); i_cpu++) {
				a_workers.push(await load_argon_worker());
			}
		}

		b_initd = true;

		xt_init = performance.now();

		clearInterval(i_update);
		i_update = (globalThis as typeof window).setInterval(() => {
			if(b_paused) return;

			xtl_elapsed = performance.now() - xt_init;
			xtl_arrival = xtl_estimate - xtl_elapsed;

			const x_approx = c_guesses / ((2 ** n_difficulty) + (2 ** (n_difficulty - 1)));

			// let x_ideal = xtl_elapsed / xtl_arrival;
			// x_ideal = Math.max(0, x_ideal - (x_ideal * (0.8 / a_samples.length)));
			if(x_approx < 0.5) {
				x_progress = x_approx;
			}
			// manage user expectations with huerstics
			else {
				// x_progress = 0.5 * (1 + (xtl_elapsed / xtl_max));
				x_progress = c_guesses / (2 ** (n_difficulty + 1));

				// f\left(x\right)=1-0.5\cdot\left(1-0.5\cdot\left(x-0.5\right)\right)^{4.5}

				x_progress = Math.max(0.5, 1 - (0.5 * Math.pow(1 - (0.5 * (x_progress - 0.5)), 4.5)));
			}
		}, 500);

		// start on each worker staggered
		for(const [i_worker, k_worker] of a_workers.entries()) {
			void attempt(k_worker, i_worker);
		}
	}

	onMount(() => {
		void start();
	});

	const N_PRECISION_SECONDS_HUMAN = 1;
	function microseconds_to_human(xtl_amount: number, b_allow_negative=false): string {
		const x_seconds = Math.max(xtl_amount / 1e3, b_allow_negative? -Infinity: 0);

		const s_min = ''+(x_seconds < 0? Math.ceil(x_seconds / 60): Math.floor(x_seconds / 60));
		const s_sec = ''+((Math.round(x_seconds / N_PRECISION_SECONDS_HUMAN) * N_PRECISION_SECONDS_HUMAN) % 60);

		return `${s_min.padStart(2, '0')}m:${s_sec.padStart(2, '0')}s`;
	}

	let xtl_debt = 0;

	function toggle_state() {
		if(b_paused) {
			xt_init = performance.now() - xtl_debt;

			for(const f_resume of a_paused) {
				f_resume();
			}

			s_pause_button = 'Pause';
		}
		else {
			xtl_debt = xtl_elapsed;

			s_pause_button = 'Pausing...';
		}

		b_paused = !b_paused;
	}

</script>

<style lang="less">
	@import '../_base.less';

	.summary {
		margin: var(--ui-padding) calc(2 * var(--ui-padding));

		.name {
			color: var(--theme-color-blue);
			font-weight: 500;
		}
	}

	.times {
		display: flex;
		justify-content: space-between;
		font-size: 13px;
		color: var(--theme-color-text-med);
		.font-family_mono();

		.remaining { 
			display: flex;
			gap: 6px;
		}
	}

	.invisible {
		visibility: hidden;
	}

	section {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		flex-grow: 1;
		flex-shrink: 0;
	}

	.status {
		display: flex;
		flex-direction: column;
		gap: 8px;

		>p {
			margin-top: 0;
			margin-bottom: 4px;
		}
	}
</style>

<Screen>

	<h3>
		<span class="global_svg-icon icon-diameter_22px">
			{@html SX_ICON_RED_CARD}
		</span>
			
		<span>
			Solving for Red Card
		</span>
	</h3>

	<section class="flex_1">
		<div />

		<LoadingAnimation --opacity={b_paused? '0.2': '1'} {xad_rotation} />

		<div class="status">
			<p>
				Solver may complete at any moment. Progress below is only a statistical estimation.
			</p>
	
			<ProgressBar {x_progress} />
	
			<div>
				<div class="times" class:invisible={!c_batch_attempts}>
					<span>
						{microseconds_to_human(xtl_elapsed)}
					</span>
					<span class="remaining">
						<span>
							ETA: {microseconds_to_human(xtl_arrival)} ~ {microseconds_to_human(xtl_max - xtl_elapsed)}
						</span>
						<!-- <span>
							Max: {microseconds_to_human(xtl_max - xtl_elapsed)}
						</span> -->
					</span>
				</div>
			</div>
		</div>
	</section>

	<ActionsWall>
		<button on:click={toggle_state}>{s_pause_button}</button>
		<button class="cautionary" on:click={abort}>Abort</button>
	</ActionsWall>
</Screen>
