<template>
	<main class="min-h-dvh bg-gradient-to-b from-[#bfd4e5] from-[0%] to-[#f4f4f5] to-[68%]">
		<section class="mx-auto flex min-h-dvh w-full max-w-[440px] px-[30px] pb-8 pt-8">
			<article
				class="mt-[64px] w-full rounded-[30px] bg-[#ececef]"
				:class="screenState === 'searching'
					? 'relative h-[620px] px-[22px] pb-7 pt-[22px]'
					: screenState === 'not_found'
						? 'h-[646px] px-7 pb-12 pt-[74px]'
						: 'h-[620px] px-7 pb-10 pt-[74px]'"
			>
				<template v-if="screenState === 'searching'">
					<div class="rounded-[30px] bg-gradient-to-b from-[#3d9fea] to-[#66b3ea] px-4 pb-[22px] pt-[18px] text-center text-[#f4f4f5]">
						<p class="text-[48px] leading-none font-medium tracking-[-0.02em]">
							Поиск звонка
						</p>
						<p class="mt-6 text-[70px] leading-none font-medium tracking-[-0.03em]">
							{{ formattedSearchTime }}
						</p>
						<p class="-mt-1 text-[24px] leading-none font-medium tracking-[-0.02em] text-white/45">
							минуты:секунды
						</p>
					</div>

					<div class="mt-[26px] flex items-start gap-4 pr-2">
						<div class="mt-1 h-[50px] w-[50px] shrink-0 rounded-full bg-gradient-to-br from-[#68b9ee] to-[#2f8ddf]" />
						<div>
							<p class="text-[14px] leading-none font-medium text-black">
								Олеся AI
							</p>
							<p class="mt-3 whitespace-pre-line text-[14px] leading-[1.28] font-medium tracking-[-0.01em] text-black">
								{{ searchingHintText }}
							</p>
						</div>
					</div>

					<div
						v-if="showAiHint"
						class="absolute inset-0 z-20"
					>
						<button
							type="button"
							aria-label="Скрыть подсказку"
							class="absolute inset-0 bg-transparent"
							@click="hideAiHint"
						/>

						<img
							src="/Group 169 (1).png"
							alt=""
							aria-hidden="true"
							class="pointer-events-none absolute left-[-16px] top-[70px] w-[230px] select-none"
						>

						<img
							src="/Vector 216.png"
							alt=""
							aria-hidden="true"
							class="pointer-events-none absolute bottom-[44px] left-[72px] w-[210px] select-none opacity-95"
						>
					</div>

					<div class="absolute bottom-7 left-[22px] right-[22px]">
						<div class="relative flex h-[56px] items-center rounded-full bg-[#f4f4f5] pl-[28px] pr-[72px]">
							<p class="text-[14px] leading-none font-medium text-black/13">
								Напишите сообщение...
							</p>
							<button
								type="button"
								disabled
								aria-label="Отправить"
								class="absolute right-[7px] top-1/2 flex h-[42px] w-[42px] -translate-y-1/2 items-center justify-center rounded-full bg-[#1591f0] text-[36px] leading-none font-light text-white shadow-[0_2px_6px_rgba(0,0,0,0.22)]"
							>
								›
							</button>
						</div>
					</div>
				</template>

				<template v-else-if="screenState === 'found'">
					<img
						src="/find.png"
						alt="Звонок найден"
						class="mx-auto h-auto w-[244px] object-contain"
					>
					<p class="mt-[92px] text-center text-[22px] leading-[1.1] font-medium tracking-[-0.01em] text-black">
						Звонок найден!
						<br>
						Соединяем...
					</p>
				</template>

				<template v-else>
					<img
						src="/nofind.png"
						alt="Звонок не найден"
						class="mx-auto h-auto w-[246px] object-contain"
					>
					<p class="mt-[86px] text-center text-[22px] leading-[1.1] font-medium tracking-[-0.01em] text-black">
						Звонок не найден :(
						<br>
						Давай попробуем позже
					</p>

					<div class="mt-[28px] flex flex-col items-center">
						<button
							type="button"
							class="h-[56px] w-full max-w-[254px] rounded-[22px] bg-[#50a9ed] text-[16px] leading-none font-medium tracking-[-0.01em] text-[#f4f4f5] transition hover:brightness-105"
							:disabled="isBusy"
							@click="startSearch"
						>
							Попробовать снова
						</button>

						<NuxtLink
							to="/home"
							class="mt-[14px] flex h-[50px] w-full max-w-[190px] items-center justify-center rounded-[22px] bg-black text-[14px] leading-none font-medium tracking-[-0.01em] text-[#f4f4f5] transition hover:brightness-110"
						>
							Главный экран
						</NuxtLink>
					</div>
				</template>
			</article>
		</section>
	</main>
</template>

<script setup lang="ts">
const SEARCH_TOTAL_SECONDS = 39;
const SEARCH_TIMEOUT_MS = SEARCH_TOTAL_SECONDS * 1000;
const RETRY_INTERVAL_MS = 1500;

type SearchState = "searching" | "found" | "not_found";

const call = useCallMatching();
const route = useRoute();

const screenState = ref<SearchState>("searching");
const isBusy = ref(false);
const searchRunId = ref(0);
const searchSecondsPassed = ref(0);
const showAiHint = ref(true);

let countdownTimer: ReturnType<typeof setInterval> | null = null;
let countdownStartedAtMs = 0;

const searchingHintText = `Информация которая может при
звонке Информация которая может
при звонке Информация которая
может при звонке Информация
которая может при звонке
Информация которая может при
звонке

Если что задавай вопросы! Разберем
вместе :)`;

const formattedSearchTime = computed(() => {
	return `0:${String(Math.max(0, searchSecondsPassed.value)).padStart(2, "0")}`;
});

function clearCountdownTimer(): void {
	if (!countdownTimer) {
		return;
	}

	clearInterval(countdownTimer);
	countdownTimer = null;
}

function startCountdown(): void {
	clearCountdownTimer();
	countdownStartedAtMs = Date.now();
	searchSecondsPassed.value = 0;

	countdownTimer = setInterval(() => {
		const elapsedSeconds = Math.floor((Date.now() - countdownStartedAtMs) / 1000);
		searchSecondsPassed.value = Math.min(SEARCH_TOTAL_SECONDS, Math.max(0, elapsedSeconds));
		if (searchSecondsPassed.value >= SEARCH_TOTAL_SECONDS) {
			clearCountdownTimer();
		}
	}, 250);
}

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function hideAiHint(): void {
	showAiHint.value = false;
}

async function startSearch(): Promise<void> {
	if (isBusy.value) {
		return;
	}

	const runId = searchRunId.value + 1;
	searchRunId.value = runId;
	isBusy.value = true;
	screenState.value = "searching";
	showAiHint.value = true;
	startCountdown();

	const startedAt = Date.now();
	try {
		while (runId === searchRunId.value && Date.now() - startedAt < SEARCH_TIMEOUT_MS) {
			const result = await call.claimHelpRequest();
			if (result.found && result.sessionId) {
				screenState.value = "found";
				clearCountdownTimer();
				await sleep(900);

				if (runId !== searchRunId.value) {
					return;
				}

				const targetPath = "/call/session";
				const targetQuery = {
					session: result.sessionId,
					name: String(result.blindName || "").trim()
				};

				try {
					await navigateTo({
						path: targetPath,
						query: targetQuery
					});
				} catch {
					if (import.meta.client) {
						const params = new URLSearchParams(targetQuery).toString();
						window.location.assign(`${targetPath}?${params}`);
					}
				}

				if (import.meta.client && route.path === "/call") {
					const params = new URLSearchParams(targetQuery).toString();
					window.location.assign(`${targetPath}?${params}`);
				}
				return;
			}

			await sleep(RETRY_INTERVAL_MS);
		}

		if (runId === searchRunId.value) {
			screenState.value = "not_found";
		}
	} finally {
		if (runId === searchRunId.value) {
			clearCountdownTimer();
			isBusy.value = false;
		}
	}
}

onMounted(() => {
	void startSearch();
});

onBeforeUnmount(() => {
	searchRunId.value += 1;
	clearCountdownTimer();
});
</script>
